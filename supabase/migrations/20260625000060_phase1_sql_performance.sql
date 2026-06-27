-- v60: Phase 1 SQL performance — skip redundant counts on keyset pages,
-- merge dashboard product scans, fast-path workflow counts, benchmark RPC, ANALYZE

-- ---------------------------------------------------------------------------
-- 1) get_owner_products_page — shared filter CTE; skip COUNT on keyset cursor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_owner_products_page(
  p_owner_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_profile TEXT DEFAULT 'grid',
  p_cursor TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_offset INT;
  v_total BIGINT;
  v_products JSONB;
  v_profile TEXT;
  v_cursor_ts TIMESTAMPTZ;
  v_cursor_id UUID;
  v_use_keyset BOOLEAN := false;
  v_has_more BOOLEAN := false;
  v_next_cursor TEXT;
  v_last_created TIMESTAMPTZ;
  v_last_id UUID;
  v_search TEXT;
  v_category TEXT;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_profile := COALESCE(NULLIF(lower(trim(p_profile)), ''), 'grid');
  v_search := NULLIF(trim(p_search), '');
  v_category := NULLIF(trim(p_category), '');

  IF NULLIF(trim(p_cursor), '') IS NOT NULL AND position('|' IN trim(p_cursor)) > 0 THEN
    v_cursor_ts := split_part(trim(p_cursor), '|', 1)::timestamptz;
    v_cursor_id := split_part(trim(p_cursor), '|', 2)::uuid;
    v_use_keyset := true;
  END IF;

  WITH filtered AS (
    SELECT p.*
    FROM public.products p
    WHERE p.owner_id = p_owner_id
      AND (v_category IS NULL OR p.category = v_category)
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS cnt FROM filtered
  ),
  fetched AS (
    SELECT f.*
    FROM filtered f
    WHERE (
      NOT v_use_keyset
      OR (f.created_at, f.id) < (v_cursor_ts, v_cursor_id)
    )
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT v_limit + 1
    OFFSET CASE WHEN v_use_keyset THEN 0 ELSE v_offset END
  ),
  page AS (
    SELECT * FROM fetched
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
  )
  SELECT
    CASE WHEN v_use_keyset THEN NULL ELSE (SELECT cnt FROM counted) END,
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN v_profile = 'full' THEN
              jsonb_build_object(
                'id', pg.id, 'name', pg.name, 'description', pg.description, 'category', pg.category,
                'price', pg.price, 'cost', pg.cost, 'original_price', pg.original_price,
                'image_url', pg.image_url, 'additional_images', pg.additional_images,
                'stock_quantity', pg.stock_quantity, 'min_stock_level', pg.min_stock_level,
                'sizes', pg.sizes, 'colors', pg.colors, 'variants', pg.variants,
                'is_active', pg.is_active, 'archived_at', pg.archived_at,
                'discount_type', pg.discount_type, 'discount_value', pg.discount_value,
                'discount_start_date', pg.discount_start_date, 'discount_end_date', pg.discount_end_date,
                'created_at', pg.created_at, 'updated_at', pg.updated_at
              )
            WHEN v_profile = 'inventory' THEN
              jsonb_build_object(
                'id', pg.id, 'name', pg.name, 'category', pg.category, 'price', pg.price,
                'image_url', pg.image_url, 'stock_quantity', pg.stock_quantity,
                'sizes', pg.sizes, 'colors', pg.colors, 'variants', pg.variants,
                'is_active', pg.is_active, 'archived_at', pg.archived_at,
                'min_stock_level', pg.min_stock_level, 'created_at', pg.created_at
              )
            ELSE
              jsonb_build_object(
                'id', pg.id, 'name', pg.name, 'category', pg.category, 'price', pg.price,
                'original_price', pg.original_price, 'image_url', pg.image_url,
                'stock_quantity', pg.stock_quantity, 'is_active', pg.is_active,
                'archived_at', pg.archived_at, 'min_stock_level', pg.min_stock_level,
                'discount_type', pg.discount_type, 'discount_value', pg.discount_value,
                'discount_start_date', pg.discount_start_date, 'discount_end_date', pg.discount_end_date,
                'created_at', pg.created_at, 'updated_at', pg.updated_at
              )
          END
          ORDER BY pg.created_at DESC, pg.id DESC
        )
        FROM page pg
      ),
      '[]'::jsonb
    ),
    (SELECT COUNT(*) > v_limit FROM fetched),
    (SELECT pg.created_at FROM page pg ORDER BY pg.created_at ASC, pg.id ASC LIMIT 1),
    (SELECT pg.id FROM page pg ORDER BY pg.created_at ASC, pg.id ASC LIMIT 1)
  INTO v_total, v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  END IF;

  RETURN jsonb_build_object(
    'products', COALESCE(v_products, '[]'::jsonb),
    'total', v_total,
    'has_more', COALESCE(v_has_more, false),
    'next_cursor', v_next_cursor,
    'profile', v_profile
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) list_merchant_orders — skip full COUNT on keyset cursor pages
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
  p_max_value numeric DEFAULT NULL,
  p_cursor text DEFAULT NULL
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
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  v_use_keyset boolean := false;
  v_next_cursor text := NULL;
  v_last_created timestamptz;
  v_last_id uuid;
  v_has_more boolean := false;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);

  IF NULLIF(trim(p_cursor), '') IS NOT NULL AND position('|' IN trim(p_cursor)) > 0 THEN
    v_cursor_ts := split_part(trim(p_cursor), '|', 1)::timestamptz;
    v_cursor_id := split_part(trim(p_cursor), '|', 2)::uuid;
    v_use_keyset := true;
  ELSE
    v_offset := GREATEST(COALESCE(p_page, 0), 0) * v_limit;
  END IF;

  WITH filtered AS (
    SELECT o.*
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
    ) o
  ),
  total_cte AS (
    SELECT CASE WHEN v_use_keyset THEN NULL::bigint ELSE COUNT(*)::bigint END AS cnt
    FROM filtered
  ),
  fetched AS (
    SELECT f.*
    FROM filtered f
    WHERE (
      NOT v_use_keyset
      OR (f.created_at, f.id) < (v_cursor_ts, v_cursor_id)
    )
    ORDER BY f.created_at DESC, f.id DESC
    LIMIT v_limit + 1
    OFFSET CASE WHEN v_use_keyset THEN 0 ELSE v_offset END
  ),
  page_orders AS (
    SELECT * FROM fetched
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
  ),
  items_by_order AS (
    SELECT
      oi.order_id,
      jsonb_agg(
        jsonb_build_object('id', oi.id, 'product_id', oi.product_id)
        ORDER BY oi.id
      ) AS order_items
    FROM public.order_items oi
    INNER JOIN page_orders po ON po.id = oi.order_id
    GROUP BY oi.order_id
  )
  SELECT
    (SELECT cnt FROM total_cte),
    COALESCE(jsonb_agg(sub.row_data ORDER BY sub.sort_created DESC, sub.sort_id DESC), '[]'::jsonb),
    (SELECT COUNT(*) > v_limit FROM fetched),
    (array_agg(sub.sort_created ORDER BY sub.sort_created ASC, sub.sort_id ASC))[1],
    (array_agg(sub.sort_id ORDER BY sub.sort_created ASC, sub.sort_id ASC))[1]
  INTO v_total, v_orders, v_has_more, v_last_created, v_last_id
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
      po.id AS sort_id
    FROM page_orders po
    LEFT JOIN items_by_order ib ON ib.order_id = po.id
  ) sub;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', GREATEST(COALESCE(p_page, 0), 0),
    'page_size', v_limit,
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', v_has_more
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchant_orders(
  uuid, int, int, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) count_merchant_orders_by_workflow — fast path when no filters active
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_merchant_orders_by_workflow(
  p_owner_id uuid,
  p_search text DEFAULT NULL,
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
  v_counts jsonb;
  v_unfiltered boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_unfiltered :=
    (p_search IS NULL OR btrim(p_search) = '')
    AND COALESCE(p_order_status, 'all') = 'all'
    AND COALESCE(p_payment_status, 'all') = 'all'
    AND COALESCE(p_delivery_status, 'all') = 'all'
    AND p_date_from IS NULL
    AND p_date_to IS NULL
    AND p_min_value IS NULL
    AND p_max_value IS NULL;

  IF v_unfiltered THEN
    SELECT jsonb_build_object(
      'all', COUNT(*)::bigint,
      'new', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'new'),
      'processing', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'processing'),
      'paid', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'paid'),
      'shipped', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'shipped'),
      'delivered', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'delivered'),
      'cancelled', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'cancelled'),
      'refunded', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'refunded')
    )
    INTO v_counts
    FROM public.orders o
    WHERE o.owner_id = p_owner_id;
  ELSE
    SELECT jsonb_build_object(
      'all', COUNT(*)::bigint,
      'new', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'new'),
      'processing', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'processing'),
      'paid', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'paid'),
      'shipped', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'shipped'),
      'delivered', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'delivered'),
      'cancelled', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'cancelled'),
      'refunded', COUNT(*) FILTER (WHERE public.order_workflow_category(o.status, o.payment_status, o.delivery_status) = 'refunded')
    )
    INTO v_counts
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      'all', p_date_from, p_date_to, p_min_value, p_max_value
    ) o;
  END IF;

  RETURN v_counts;
END;
$$;

REVOKE ALL ON FUNCTION public.count_merchant_orders_by_workflow(uuid, text, text, text, text, timestamptz, timestamptz, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_merchant_orders_by_workflow(uuid, text, text, text, text, timestamptz, timestamptz, numeric, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) get_dashboard_statistics_batch — single product scan for catalog KPIs
-- ---------------------------------------------------------------------------
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
    'product_count', COUNT(*) FILTER (
      WHERE COALESCE(is_active, true) = true AND archived_at IS NULL
    )::INT,
    'low_stock_count', COUNT(*) FILTER (
      WHERE COALESCE(is_active, true) = true
        AND archived_at IS NULL
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    )::INT
  ) INTO v_static
  FROM public.products
  WHERE owner_id = p_owner_id;

  SELECT
    COUNT(*) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end AND o.status <> 'cancelled'
    )::INT AS today_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS today_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_yesterday_start AND o.created_at <= v_yesterday_end AND o.status <> 'cancelled'
    )::INT AS yesterday_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_yesterday_start AND o.created_at <= v_yesterday_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS yesterday_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end AND o.status <> 'cancelled'
    )::INT AS week_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS week_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_prev_week_start AND o.created_at <= v_prev_week_end AND o.status <> 'cancelled'
    )::INT AS prev_week_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_prev_week_start AND o.created_at <= v_prev_week_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS prev_week_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_month_start AND o.created_at <= v_month_end AND o.status <> 'cancelled'
    )::INT AS month_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_month_start AND o.created_at <= v_month_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
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
    'all_time', public._dashboard_period_json(
      v_all_time_orders, v_all_time_revenue, v_all_time_visits, v_all_time_refunds, 'rollup_plus_live'
    ) || v_static,
    'catalog_kpis', v_static,
    'workflow_counts', public.count_merchant_orders_by_workflow(
      p_owner_id, NULL, 'all', 'all', 'all', NULL, NULL, NULL, NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_statistics_batch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics_batch(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) order_items — index for list_merchant_orders page join (order_id IN page)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_id
  ON public.order_items (order_id, id);

COMMENT ON INDEX public.idx_order_items_order_id_id IS
  'list_merchant_orders items_by_order — nested loop join on page order ids';

-- ---------------------------------------------------------------------------
-- 6) platform_benchmark_hot_queries — EXPLAIN ANALYZE for Phase 1 (service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_benchmark_hot_queries(
  p_slug text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_warm_cache boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_owner uuid;
  v_results jsonb := '[]'::jsonb;
  v_plan jsonb;
  v_exec_ms numeric;
  v_plan_ms numeric;
  rec record;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only';
  END IF;

  SELECT ss.store_slug, ss.owner_id
  INTO v_slug, v_owner
  FROM public.store_settings ss
  WHERE ss.store_slug IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST
  LIMIT 1;

  v_slug := COALESCE(NULLIF(trim(p_slug), ''), v_slug);
  v_owner := COALESCE(p_owner_id, v_owner);

  IF p_warm_cache THEN
    BEGIN
      PERFORM pg_prewarm('products');
      PERFORM pg_prewarm('orders');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);

  FOR rec IN
    SELECT * FROM (VALUES
      ('storefront_meta', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_store_meta(%L::text)',
        v_slug
      )),
      ('storefront_products_page', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_store_products_page(%L, 24, NULL, NULL, NULL)',
        v_slug
      )),
      ('owner_products_page', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', NULL)',
        v_owner
      )),
      ('orders_list', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.list_merchant_orders(%L::uuid, 0, 50, NULL, ''all'', ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL, NULL)',
        v_owner
      )),
      ('workflow_counts', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.count_merchant_orders_by_workflow(%L::uuid, NULL, ''all'', ''all'', ''all'', NULL, NULL, NULL, NULL)',
        v_owner
      )),
      ('dashboard_batch', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_dashboard_statistics_batch(%L::uuid)',
        v_owner
      )),
      ('products_owner_index', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT COUNT(*) FROM public.products WHERE owner_id = %L::uuid AND archived_at IS NULL',
        v_owner
      )),
      ('orders_owner_index', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT COUNT(*) FROM public.orders WHERE owner_id = %L::uuid',
        v_owner
      ))
    ) AS t(name, sql_text)
  LOOP
    BEGIN
      EXECUTE rec.sql_text INTO v_plan;
      v_exec_ms := (v_plan->0->>'Execution Time')::numeric;
      v_plan_ms := (v_plan->0->>'Planning Time')::numeric;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', rec.name,
        'plan', v_plan,
        'execution_ms', v_exec_ms,
        'planning_ms', v_plan_ms
      ));
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', rec.name,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'benchmark_at', now(),
    'slug', v_slug,
    'owner_id', v_owner,
    'queries', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_benchmark_hot_queries(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_benchmark_hot_queries(text, uuid, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) Refresh planner statistics on hot tables
-- ---------------------------------------------------------------------------
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.store_visits;
ANALYZE public.store_daily_stats;
ANALYZE public.customers;
ANALYZE public.product_reviews;
ANALYZE public.inventory_movements;
ANALYZE public.store_settings;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (60, 'phase1_sql_performance: keyset skip-count, dashboard single product scan, benchmark RPC')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
