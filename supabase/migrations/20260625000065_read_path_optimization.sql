-- v65: Read-path optimization — FK indexes, query rewrites, extended benchmarks, ANALYZE
-- Consolidates Phases 1–10 read-path work (indexes, FK coverage, execution plans, payloads)

-- ---------------------------------------------------------------------------
-- 1) Drop redundant / tenant-unsafe indexes
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_order_items_product_id;
-- Global product_id without owner_id — superseded by idx_order_items_owner_product_created (v63)

DROP INDEX IF EXISTS public.idx_suggested_products_product_id;
DROP INDEX IF EXISTS public.idx_suggested_product_id;
-- Superseded by idx_suggested_products_owner_product (v63)

DROP INDEX IF EXISTS public.idx_store_visits_owner_id;
-- Superseded by idx_store_visits_owner_created (owner_id, created_at DESC)

-- ---------------------------------------------------------------------------
-- 2) FK-supporting + covering indexes (owner_id first)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_refunds_owner_completed
  ON public.order_refunds (owner_id, status)
  INCLUDE (amount, order_id)
  WHERE status = 'completed';

COMMENT ON INDEX public.idx_order_refunds_owner_completed IS
  'Dashboard refund aggregates + get_store_statistics refund_total — tenant-first';

CREATE INDEX IF NOT EXISTS idx_payment_transactions_owner_order
  ON public.payment_transactions (owner_id, order_id)
  INCLUDE (status, amount, created_at);

COMMENT ON INDEX public.idx_payment_transactions_owner_order IS
  'get_order_payment_summary + FK join orders — tenant-scoped';

CREATE INDEX IF NOT EXISTS idx_order_items_owner_created_covering
  ON public.order_items (owner_id, created_at DESC)
  INCLUDE (order_id, product_id, product_name, quantity, subtotal);

COMMENT ON INDEX public.idx_order_items_owner_created_covering IS
  'get_order_items_for_statistics — index-only friendly tenant scan';

CREATE INDEX IF NOT EXISTS idx_orders_owner_marketing_attribution
  ON public.orders (owner_id, created_at DESC)
  WHERE marketing_attribution IS NOT NULL
    AND marketing_attribution <> 'null'::jsonb
    AND status <> 'cancelled';

COMMENT ON INDEX public.idx_orders_owner_marketing_attribution IS
  'get_store_statistics campaign_attribution partial scan';

-- idx_product_views_owner_created + idx_customers_owner_first_last already exist (v26/v15)

-- ---------------------------------------------------------------------------
-- 3) get_order_items_for_statistics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_items_for_statistics(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_limit INT DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_items JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN '[]'::jsonb;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 10000);

  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      oi.order_id,
      oi.product_id,
      oi.product_name,
      oi.quantity,
      oi.subtotal,
      oi.created_at
    FROM public.order_items oi
    WHERE oi.owner_id = p_owner_id
      AND oi.created_at >= p_start
      AND oi.created_at <= p_end
      AND EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = oi.order_id
          AND o.owner_id = p_owner_id
          AND o.status = 'completed'
          AND COALESCE(o.payment_status, '') <> 'refunded'
          AND o.created_at >= p_start
          AND o.created_at <= p_end
      )
    ORDER BY oi.created_at DESC
    LIMIT v_limit
  ) sub;

  RETURN COALESCE(v_items, '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) get_store_statistics — merge live order scans; shared product KPI subquery
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
  v_historical_only BOOLEAN := false;
  v_rollup_orders INT;
  v_rollup_completed INT;
  v_rollup_revenue NUMERIC;
  v_rollup_visits INT;
  v_rollup_unique INT;
  v_live_orders INT := 0;
  v_live_completed INT := 0;
  v_live_revenue NUMERIC := 0;
  v_live_pending INT := 0;
  v_live_visits INT := 0;
  v_live_unique INT := 0;
  v_today_start TIMESTAMPTZ;
  v_product_count INT := 0;
  v_low_stock_count INT := 0;
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

  v_historical_only := v_has_rollup AND p_end < v_today_start;

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

  IF NOT v_historical_only THEN
    SELECT
      COUNT(*) FILTER (WHERE status <> 'cancelled')::INT,
      COUNT(*) FILTER (
        WHERE status = 'completed' AND COALESCE(payment_status, '') <> 'refunded'
      )::INT,
      COALESCE(SUM(total_amount) FILTER (
        WHERE status = 'completed' AND COALESCE(payment_status, '') <> 'refunded'
      ), 0),
      COUNT(*) FILTER (WHERE status = 'pending')::INT
    INTO v_live_orders, v_live_completed, v_live_revenue, v_live_pending
    FROM public.orders
    WHERE owner_id = p_owner_id
      AND created_at >= p_start
      AND created_at <= p_end;

    SELECT COUNT(*)::INT INTO v_live_visits
    FROM public.store_visits
    WHERE owner_id = p_owner_id
      AND created_at >= p_start
      AND created_at <= p_end;

    SELECT COUNT(DISTINCT visitor_ip)::INT INTO v_live_unique
    FROM public.store_visits
    WHERE owner_id = p_owner_id
      AND created_at >= p_start
      AND created_at <= p_end
      AND visitor_ip IS NOT NULL
      AND trim(visitor_ip) <> '';
  ELSE
    v_live_orders := v_rollup_orders;
    v_live_completed := v_rollup_completed;
    v_live_revenue := v_rollup_revenue;
    v_live_visits := v_rollup_visits;
    v_live_unique := v_rollup_unique;
    v_live_pending := 0;
  END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE COALESCE(is_active, true) = true AND archived_at IS NULL
    )::INT,
    COUNT(*) FILTER (
      WHERE COALESCE(is_active, true) = true
        AND archived_at IS NULL
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    )::INT
  INTO v_product_count, v_low_stock_count
  FROM public.products
  WHERE owner_id = p_owner_id;

  SELECT jsonb_build_object(
    'order_count', CASE WHEN v_historical_only THEN v_rollup_orders ELSE v_live_orders END,
    'completed_order_count', CASE WHEN v_historical_only THEN v_rollup_completed ELSE v_live_completed END,
    'pending_count', CASE WHEN v_historical_only THEN 0 ELSE v_live_pending END,
    'completed_revenue', CASE WHEN v_historical_only THEN v_rollup_revenue ELSE v_live_revenue END,
    'refund_total', (
      SELECT COALESCE(SUM(r.amount), 0)
      FROM public.order_refunds r
      INNER JOIN public.orders o
        ON o.id = r.order_id AND o.owner_id = r.owner_id
      WHERE r.owner_id = p_owner_id
        AND r.status = 'completed'
        AND o.status = 'completed'
        AND o.created_at >= p_start
        AND o.created_at <= p_end
    ),
    'visit_count', CASE WHEN v_historical_only THEN v_rollup_visits ELSE v_live_visits END,
    'unique_visitors', CASE
      WHEN v_end_date > v_start_date AND v_has_rollup THEN v_rollup_unique
      WHEN v_historical_only THEN v_rollup_unique
      ELSE v_live_unique
    END,
    'low_stock_count', v_low_stock_count,
    'product_count', v_product_count,
    'new_customers', (
      SELECT COUNT(*)::INT FROM public.customers
      WHERE owner_id = p_owner_id
        AND first_order_date >= p_start AND first_order_date <= p_end
    ),
    'returning_customers', (
      SELECT COUNT(*)::INT FROM public.customers c
      WHERE c.owner_id = p_owner_id
        AND c.first_order_date < p_start
        AND c.last_order_date >= p_start AND c.last_order_date <= p_end
    ),
    'top_selling_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC)
      FROM (
        SELECT
          oi.product_id,
          COALESCE(MAX(oi.product_name), 'منتج') AS product_name,
          COALESCE(SUM(oi.quantity), 0)::INT AS units,
          COALESCE(SUM(oi.subtotal), 0)::NUMERIC AS revenue
        FROM public.orders o
        INNER JOIN public.order_items oi
          ON oi.order_id = o.id AND oi.owner_id = o.owner_id
        WHERE o.owner_id = p_owner_id
          AND o.status = 'completed'
          AND COALESCE(o.payment_status, '') <> 'refunded'
          AND o.created_at >= p_start AND o.created_at <= p_end
        GROUP BY oi.product_id
        ORDER BY revenue DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'top_viewed_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.view_count DESC)
      FROM (
        SELECT pv.product_id, COALESCE(p.name, 'منتج') AS product_name, COUNT(*)::INT AS view_count
        FROM public.product_views pv
        LEFT JOIN public.products p ON p.id = pv.product_id AND p.owner_id = pv.owner_id
        WHERE pv.owner_id = p_owner_id
          AND pv.created_at >= p_start AND pv.created_at <= p_end
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
          COALESCE(SUM(
            CASE WHEN o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
              THEN o.total_amount ELSE 0 END
          ), 0)::NUMERIC AS revenue
        FROM public.orders o
        WHERE o.owner_id = p_owner_id
          AND o.created_at >= p_start AND o.created_at <= p_end
          AND o.status <> 'cancelled'
          AND o.marketing_attribution IS NOT NULL
          AND o.marketing_attribution <> 'null'::jsonb
        GROUP BY 1, 2, 3 ORDER BY orders DESC LIMIT 20
      ) t
    ), '[]'::jsonb),
    'stats_source', CASE WHEN v_historical_only THEN 'daily_rollup' ELSE 'live' END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) get_dashboard_statistics_batch — index-only all-time refunds (no orders join)
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
      WHERE r.owner_id = p_owner_id AND r.status = 'completed'
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

-- ---------------------------------------------------------------------------
-- 6) platform_fk_index_audit — missing FK indexes report
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_fk_index_audit()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fk_cols AS (
    SELECT
      c.conrelid::regclass AS table_name,
      c.conname AS fk_name,
      a.attname AS column_name,
      af.attname AS ref_column
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY (c.confkey)
    JOIN pg_namespace n ON n.oid = c.conrelid::regnamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
  ),
  indexed AS (
    SELECT
      ic.relname AS index_name,
      t.relname AS table_name,
      array_agg(a.attname ORDER BY a.attnum) AS columns
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (i.indkey)
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
    GROUP BY ic.relname, t.relname
  )
  SELECT jsonb_build_object(
    'audited_at', now(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'foreign_keys', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table', table_name::text,
        'fk', fk_name,
        'column', column_name,
        'references', ref_column,
        'has_leading_index', EXISTS (
          SELECT 1 FROM indexed idx
          WHERE idx.table_name = fk_cols.table_name::text
            AND idx.columns[1] = fk_cols.column_name
        )
      ) ORDER BY table_name::text, column_name), '[]'::jsonb)
      FROM fk_cols
    ),
    'missing_fk_indexes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table', table_name::text,
        'column', column_name,
        'fk', fk_name
      ) ORDER BY table_name::text), '[]'::jsonb)
      FROM fk_cols
      WHERE NOT EXISTS (
        SELECT 1 FROM indexed idx
        WHERE idx.table_name = fk_cols.table_name::text
          AND idx.columns[1] = fk_cols.column_name
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.platform_fk_index_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_fk_index_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 7) platform_benchmark_hot_queries — extended read-path coverage
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
  v_allowed boolean;
  v_month_start timestamptz;
  v_month_end timestamptz;
BEGIN
  v_allowed :=
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'authenticator');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ss.store_slug, ss.owner_id
  INTO v_slug, v_owner
  FROM public.store_settings ss
  WHERE ss.store_slug IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST
  LIMIT 1;

  v_slug := COALESCE(NULLIF(trim(p_slug), ''), v_slug);
  v_owner := COALESCE(p_owner_id, v_owner);
  v_month_start := date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_end := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC';

  IF p_warm_cache THEN
    BEGIN
      PERFORM pg_prewarm('products');
      PERFORM pg_prewarm('orders');
      PERFORM pg_prewarm('order_items');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_owner IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  END IF;

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
      ('storefront_page_bundle', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_storefront_page_bundle(%L, 24, '''', '''', '''')',
        v_slug
      )),
      ('owner_products_page', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', NULL)',
        v_owner
      )),
      ('owner_products_keyset', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_products_page(%L::uuid, 50, 0, NULL, NULL, ''grid'', ''2020-01-01T00:00:00+00|00000000-0000-0000-0000-000000000001'')',
        v_owner
      )),
      ('owner_bootstrap', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_owner_bootstrap(%L::uuid)',
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
      ('statistics_bundle', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_statistics_page_bundle(%L::uuid, %L::timestamptz, %L::timestamptz, %L::timestamptz, %L::timestamptz)',
        v_owner, v_month_start, v_month_end, v_month_start - INTERVAL '1 month', v_month_start - INTERVAL '1 millisecond'
      )),
      ('order_items_statistics', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.get_order_items_for_statistics(%L::uuid, %L::timestamptz, %L::timestamptz, 5000)',
        v_owner, v_month_start, v_month_end
      )),
      ('inventory_audit', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.audit_merchant_inventory_integrity(%L::uuid)',
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
    'query_count', jsonb_array_length(v_results),
    'queries', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_benchmark_hot_queries(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_benchmark_hot_queries(text, uuid, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Refresh planner statistics
-- ---------------------------------------------------------------------------
ANALYZE public.products;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.order_refunds;
ANALYZE public.payment_transactions;
ANALYZE public.store_visits;
ANALYZE public.store_daily_stats;
ANALYZE public.customers;
ANALYZE public.product_views;
ANALYZE public.inventory_movements;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (65, 'read_path_optimization: FK indexes, statistics query merge, extended benchmarks')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
