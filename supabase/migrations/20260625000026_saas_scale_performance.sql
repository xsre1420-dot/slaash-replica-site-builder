-- v36: SaaS scale performance — 100k stores / 10M products / 1M orders
-- Single-pass dashboard batch, list_merchant_orders one-scan, index hygiene

-- ---------------------------------------------------------------------------
-- 1) Drop redundant / superseded indexes
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_stores_slug_lower_trim;
-- v32 added trim variant; UNIQUE idx_stores_slug_lower already covers LOWER(store_slug)

DROP INDEX IF EXISTS public.idx_products_owner_active_created;
-- Superseded by idx_products_owner_storefront_created (v32)

DROP INDEX IF EXISTS public.idx_orders_owner_status;
-- Superseded by idx_orders_owner_status_created

-- ---------------------------------------------------------------------------
-- 2) Scale-oriented indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_owner_first_last
  ON public.customers (owner_id, first_order_date, last_order_date);

COMMENT ON INDEX public.idx_customers_owner_first_last IS
  'get_store_statistics new/returning customer KPIs — avoids full customer heap scan';

CREATE INDEX IF NOT EXISTS idx_store_visits_created_brin
  ON public.store_visits USING brin (created_at);

COMMENT ON INDEX public.idx_store_visits_created_brin IS
  'Archival / time-range scans on append-only visit log at platform scale';

CREATE INDEX IF NOT EXISTS idx_orders_owner_created_status
  ON public.orders (owner_id, created_at DESC)
  INCLUDE (status, total_amount, payment_status, delivery_status);

COMMENT ON INDEX public.idx_orders_owner_created_status IS
  'Dashboard batch FILTER aggregates + merchant order list covering columns';

-- ---------------------------------------------------------------------------
-- 3) Cap legacy unbounded storefront catalog RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_products_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  price NUMERIC,
  image_url TEXT,
  additional_images TEXT[],
  colors JSONB,
  sizes TEXT[],
  variants JSONB,
  discount_type TEXT,
  discount_value NUMERIC,
  original_price NUMERIC,
  stock_quantity INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN;
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.description, p.category, p.price,
    p.image_url, p.additional_images, p.colors, p.sizes, p.variants,
    p.discount_type, p.discount_value, p.original_price, p.stock_quantity
  FROM public.products p
  WHERE p.owner_id = v_owner_id
    AND p.archived_at IS NULL
    AND COALESCE(p.is_active, true) = true
  ORDER BY p.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_products_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_products_by_slug(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Bootstrap — owner_id only (no OR store_id predicates)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_owner_bootstrap(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'store', (
      SELECT json_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'store_name', s.store_name,
        'store_slug', s.store_slug,
        'theme_id', COALESCE(s.theme_id, 'default')
      )
      FROM public.stores s
      WHERE s.user_id = p_user_id
      LIMIT 1
    ),
    'settings', (
      SELECT row_to_json(ss.*)
      FROM public.store_settings ss
      WHERE ss.owner_id = p_user_id
      LIMIT 1
    ),
    'categories', COALESCE((
      SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'order', c.display_order) ORDER BY c.display_order)
      FROM public.categories c
      WHERE c.owner_id = p_user_id
    ), '[]'::json),
    'products', COALESCE((
      SELECT json_agg(row_to_json(p.*) ORDER BY p.created_at DESC)
      FROM (
        SELECT id, name, description, category, price, cost, image_url, stock_quantity, is_active, store_id, created_at
        FROM public.products
        WHERE owner_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 50
      ) p
    ), '[]'::json),
    'orders_count', (
      SELECT COUNT(*)::int
      FROM public.orders
      WHERE owner_id = p_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_bootstrap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_bootstrap(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) list_merchant_orders — one filter scan (COUNT OVER) instead of two
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_merchant_orders(
  p_owner_id uuid,
  p_page int DEFAULT 0,
  p_page_size int DEFAULT 50,
  p_search text DEFAULT NULL,
  p_workflow_tab text DEFAULT 'all',
  p_order_status text DEFAULT 'all',
  p_payment_status text DEFAULT 'all',
  p_delivery_status text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_min_value numeric DEFAULT NULL,
  p_max_value numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_orders jsonb;
  v_limit int;
  v_offset int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_page, 0), 0) * v_limit;

  WITH filtered AS (
    SELECT o.*
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
    ) o
  ),
  page_orders AS (
    SELECT f.*, COUNT(*) OVER () AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ),
  items_by_order AS (
    SELECT
      oi.order_id,
      jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'product_price', oi.product_price,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal,
          'variant_metadata', oi.variant_metadata
        )
      ) AS order_items
    FROM public.order_items oi
    INNER JOIN page_orders po ON po.id = oi.order_id
    GROUP BY oi.order_id
  )
  SELECT
    COALESCE(MAX(sub.total_count), 0),
    COALESCE(jsonb_agg(sub.row_data ORDER BY sub.sort_created DESC), '[]'::jsonb)
  INTO v_total, v_orders
  FROM (
    SELECT
      jsonb_build_object(
        'id', po.id,
        'status', po.status,
        'total_amount', po.total_amount,
        'created_at', po.created_at,
        'updated_at', po.updated_at,
        'customer_name', po.customer_name,
        'customer_phone', po.customer_phone,
        'customer_address', po.customer_address,
        'customer_governorate', po.customer_governorate,
        'notes', po.notes,
        'delivery_fee', po.delivery_fee,
        'delivery_status', po.delivery_status,
        'payment_method', po.payment_method,
        'payment_status', po.payment_status,
        'coupon_code', po.coupon_code,
        'discount_amount', po.discount_amount,
        'order_items', COALESCE(ib.order_items, '[]'::jsonb)
      ) AS row_data,
      po.created_at AS sort_created,
      po.total_count
    FROM page_orders po
    LEFT JOIN items_by_order ib ON ib.order_id = po.id
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', GREATEST(COALESCE(p_page, 0), 0),
    'page_size', v_limit,
    'orders', COALESCE(v_orders, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) Dashboard batch — single-pass period aggregates (was 6× get_store_statistics)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._dashboard_period_json(
  p_orders INT,
  p_completed_revenue NUMERIC,
  p_visits INT,
  p_refunds NUMERIC DEFAULT 0,
  p_source TEXT DEFAULT 'live_batch'
) RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'order_count', COALESCE(p_orders, 0),
    'completed_revenue', COALESCE(p_completed_revenue, 0),
    'visit_count', COALESCE(p_visits, 0),
    'refund_total', COALESCE(p_refunds, 0),
    'stats_source', COALESCE(p_source, 'live_batch')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_statistics_batch(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_yesterday_start TIMESTAMPTZ;
  v_yesterday_end TIMESTAMPTZ;
  v_week_start TIMESTAMPTZ;
  v_week_end TIMESTAMPTZ;
  v_prev_week_start TIMESTAMPTZ;
  v_prev_week_end TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_order_row RECORD;
  v_visit_row RECORD;
  v_rollup RECORD;
  v_static JSONB;
  v_all_time_orders INT;
  v_all_time_revenue NUMERIC;
  v_all_time_visits INT;
  v_all_time_refunds NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  v_today_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_end := v_today_start + INTERVAL '1 day' - INTERVAL '1 millisecond';
  v_yesterday_start := v_today_start - INTERVAL '1 day';
  v_yesterday_end := v_today_start - INTERVAL '1 millisecond';
  v_week_start := date_trunc('week', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_week_end := v_week_start + INTERVAL '7 days' - INTERVAL '1 millisecond';
  v_prev_week_start := v_week_start - INTERVAL '7 days';
  v_prev_week_end := v_week_start - INTERVAL '1 millisecond';
  v_month_start := date_trunc('month', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_end := (date_trunc('month', v_now AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC' - INTERVAL '1 millisecond';

  SELECT jsonb_build_object(
    'low_stock_count', (
      SELECT COUNT(*)::INT FROM public.products
      WHERE owner_id = p_owner_id AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    ),
    'product_count', (
      SELECT COUNT(*)::INT FROM public.products
      WHERE owner_id = p_owner_id
        AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
    )
  ) INTO v_static;

  SELECT
    COUNT(*) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end AND o.status <> 'cancelled'
    )::INT AS today_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end AND o.status = 'completed'
    ), 0) AS today_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_yesterday_start AND o.created_at <= v_yesterday_end AND o.status <> 'cancelled'
    )::INT AS yesterday_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_yesterday_start AND o.created_at <= v_yesterday_end AND o.status = 'completed'
    ), 0) AS yesterday_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end AND o.status <> 'cancelled'
    )::INT AS week_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end AND o.status = 'completed'
    ), 0) AS week_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_prev_week_start AND o.created_at <= v_prev_week_end AND o.status <> 'cancelled'
    )::INT AS prev_week_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_prev_week_start AND o.created_at <= v_prev_week_end AND o.status = 'completed'
    ), 0) AS prev_week_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_month_start AND o.created_at <= v_month_end AND o.status <> 'cancelled'
    )::INT AS month_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_month_start AND o.created_at <= v_month_end AND o.status = 'completed'
    ), 0) AS month_revenue,
    COALESCE(SUM(r.amount) FILTER (
      WHERE o.status = 'completed' AND r.status = 'completed'
        AND o.created_at >= v_today_start AND o.created_at <= v_today_end
    ), 0) AS today_refunds,
    COALESCE(SUM(r.amount) FILTER (
      WHERE o.status = 'completed' AND r.status = 'completed'
        AND o.created_at >= v_month_start AND o.created_at <= v_month_end
    ), 0) AS month_refunds
  INTO v_order_row
  FROM public.orders o
  LEFT JOIN public.order_refunds r ON r.order_id = o.id AND r.owner_id = p_owner_id
  WHERE o.owner_id = p_owner_id
    AND o.created_at >= v_prev_week_start;

  SELECT
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_today_start AND sv.created_at <= v_today_end
    )::INT AS today_visits,
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_yesterday_start AND sv.created_at <= v_yesterday_end
    )::INT AS yesterday_visits,
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_week_start AND sv.created_at <= v_week_end
    )::INT AS week_visits,
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_prev_week_start AND sv.created_at <= v_prev_week_end
    )::INT AS prev_week_visits,
    COUNT(*) FILTER (
      WHERE sv.created_at >= v_month_start AND sv.created_at <= v_month_end
    )::INT AS month_visits
  INTO v_visit_row
  FROM public.store_visits sv
  WHERE sv.owner_id = p_owner_id
    AND sv.created_at >= v_prev_week_start;

  SELECT
    COALESCE(SUM(sds.order_count - sds.cancelled_order_count), 0)::INT AS rollup_orders,
    COALESCE(SUM(sds.completed_revenue), 0) AS rollup_revenue,
    COALESCE(SUM(sds.visit_count), 0)::INT AS rollup_visits
  INTO v_rollup
  FROM public.store_daily_stats sds
  WHERE sds.owner_id = p_owner_id
    AND sds.stat_date < (v_today_start AT TIME ZONE 'UTC')::DATE;

  SELECT
    COALESCE(v_rollup.rollup_orders, 0) + COALESCE(v_order_row.today_orders, 0),
    COALESCE(v_rollup.rollup_revenue, 0) + COALESCE(v_order_row.today_revenue, 0),
    COALESCE(v_rollup.rollup_visits, 0) + COALESCE(v_visit_row.today_visits, 0),
    COALESCE((
      SELECT SUM(r.amount)
      FROM public.order_refunds r
      JOIN public.orders o ON o.id = r.order_id
      WHERE r.owner_id = p_owner_id AND r.status = 'completed' AND o.status = 'completed'
    ), 0)
  INTO v_all_time_orders, v_all_time_revenue, v_all_time_visits, v_all_time_refunds;

  RETURN jsonb_build_object(
    'today', public._dashboard_period_json(
      v_order_row.today_orders, v_order_row.today_revenue, v_visit_row.today_visits, v_order_row.today_refunds
    ),
    'yesterday', public._dashboard_period_json(
      v_order_row.yesterday_orders, v_order_row.yesterday_revenue, v_visit_row.yesterday_visits
    ),
    'week', public._dashboard_period_json(
      v_order_row.week_orders, v_order_row.week_revenue, v_visit_row.week_visits
    ),
    'previous_week', public._dashboard_period_json(
      v_order_row.prev_week_orders, v_order_row.prev_week_revenue, v_visit_row.prev_week_visits
    ),
    'month', public._dashboard_period_json(
      v_order_row.month_orders, v_order_row.month_revenue, v_visit_row.month_visits, v_order_row.month_refunds
    ),
    'all_time', v_static || public._dashboard_period_json(
      v_all_time_orders, v_all_time_revenue, v_all_time_visits, v_all_time_refunds, 'rollup_plus_live'
    ),
    'workflow_counts', public.count_merchant_orders_by_workflow(
      p_owner_id, NULL, 'all', 'all', 'all', 'all', NULL, NULL, NULL, NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._dashboard_period_json(INT, NUMERIC, INT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._dashboard_period_json(INT, NUMERIC, INT, NUMERIC, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_dashboard_statistics_batch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics_batch(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) get_store_statistics — prefer rollup unique_visitors for multi-day ranges
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_statistics(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start_date DATE;
  v_end_date DATE;
  v_has_rollup BOOLEAN := false;
  v_rollup_orders INT;
  v_rollup_completed INT;
  v_rollup_revenue NUMERIC;
  v_rollup_visits INT;
  v_rollup_unique INT;
  v_live_orders INT;
  v_live_completed INT;
  v_live_revenue NUMERIC;
  v_live_visits INT;
  v_live_unique INT;
  v_today_start TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN NULL;
  END IF;

  v_start_date := (p_start AT TIME ZONE 'UTC')::DATE;
  v_end_date := (p_end AT TIME ZONE 'UTC')::DATE;
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT EXISTS (
    SELECT 1 FROM public.store_daily_stats
    WHERE owner_id = p_owner_id
      AND stat_date >= v_start_date
      AND stat_date <= v_end_date
  ) INTO v_has_rollup;

  SELECT
    COALESCE(SUM(order_count - cancelled_order_count), 0)::INT,
    COALESCE(SUM(completed_order_count), 0)::INT,
    COALESCE(SUM(completed_revenue), 0),
    COALESCE(SUM(visit_count), 0)::INT,
    COALESCE(SUM(unique_visitors), 0)::INT
  INTO v_rollup_orders, v_rollup_completed, v_rollup_revenue, v_rollup_visits, v_rollup_unique
  FROM public.store_daily_stats
  WHERE owner_id = p_owner_id
    AND stat_date >= v_start_date
    AND stat_date <= v_end_date;

  SELECT COUNT(*)::INT INTO v_live_orders
  FROM orders
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end
    AND status <> 'cancelled';

  SELECT COUNT(*)::INT INTO v_live_completed
  FROM orders
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end
    AND status = 'completed';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_live_revenue
  FROM orders
  WHERE owner_id = p_owner_id
    AND status = 'completed'
    AND created_at >= p_start AND created_at <= p_end;

  SELECT COUNT(*)::INT INTO v_live_visits
  FROM store_visits
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end;

  SELECT COUNT(DISTINCT visitor_ip)::INT INTO v_live_unique
  FROM store_visits
  WHERE owner_id = p_owner_id
    AND created_at >= p_start AND created_at <= p_end
    AND visitor_ip IS NOT NULL AND trim(visitor_ip) <> '';

  SELECT jsonb_build_object(
    'order_count', CASE WHEN v_has_rollup AND p_end < v_today_start THEN v_rollup_orders ELSE v_live_orders END,
    'completed_order_count', CASE WHEN v_has_rollup AND p_end < v_today_start THEN v_rollup_completed ELSE v_live_completed END,
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id AND status = 'pending'
        AND created_at >= p_start AND created_at <= p_end
    ),
    'completed_revenue', CASE WHEN v_has_rollup AND p_end < v_today_start THEN v_rollup_revenue ELSE v_live_revenue END,
    'refund_total', (
      SELECT COALESCE(SUM(r.amount), 0)
      FROM order_refunds r
      JOIN orders o ON o.id = r.order_id
      WHERE r.owner_id = p_owner_id AND r.status = 'completed'
        AND o.status = 'completed'
        AND o.created_at >= p_start AND o.created_at <= p_end
    ),
    'visit_count', CASE WHEN v_has_rollup AND p_end < v_today_start THEN v_rollup_visits ELSE v_live_visits END,
    'unique_visitors', CASE
      WHEN v_end_date > v_start_date AND v_has_rollup THEN v_rollup_unique
      WHEN v_has_rollup AND p_end < v_today_start THEN v_rollup_unique
      ELSE v_live_unique
    END,
    'low_stock_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    ),
    'product_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id
        AND COALESCE(is_active, true) = true
        AND archived_at IS NULL
    ),
    'new_customers', (
      SELECT COUNT(*)::INT FROM customers
      WHERE owner_id = p_owner_id
        AND first_order_date >= p_start AND first_order_date <= p_end
    ),
    'returning_customers', (
      SELECT COUNT(*)::INT FROM customers c
      WHERE c.owner_id = p_owner_id
        AND c.first_order_date < p_start
        AND c.last_order_date >= p_start AND c.last_order_date <= p_end
    ),
    'top_viewed_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.view_count DESC)
      FROM (
        SELECT pv.product_id, COALESCE(p.name, 'منتج') AS product_name, COUNT(*)::INT AS view_count
        FROM product_views pv
        LEFT JOIN products p ON p.id = pv.product_id AND p.owner_id = pv.owner_id
        WHERE pv.owner_id = p_owner_id AND pv.created_at >= p_start AND pv.created_at <= p_end
        GROUP BY pv.product_id, p.name
        ORDER BY view_count DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'campaign_attribution', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.orders DESC)
      FROM (
        SELECT
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_source'), ''), '(direct)') AS source,
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_medium'), ''), '(none)') AS medium,
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_campaign'), ''), '(none)') AS campaign,
          COUNT(*)::INT AS orders,
          COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0)::NUMERIC AS revenue
        FROM orders o
        WHERE o.owner_id = p_owner_id AND o.created_at >= p_start AND o.created_at <= p_end
          AND o.status <> 'cancelled' AND o.marketing_attribution IS NOT NULL
          AND o.marketing_attribution <> 'null'::jsonb
        GROUP BY 1, 2, 3 ORDER BY orders DESC LIMIT 20
      ) t
    ), '[]'::jsonb),
    'stats_source', CASE WHEN v_has_rollup AND p_end < v_today_start THEN 'daily_rollup' ELSE 'live' END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Refresh planner statistics
-- ---------------------------------------------------------------------------
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.customers;
ANALYZE public.store_visits;
ANALYZE public.store_daily_stats;
ANALYZE public.stores;
ANALYZE public.store_settings;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (36, 'saas_scale: single-pass dashboard, list orders one-scan, index hygiene, bootstrap owner_id')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
