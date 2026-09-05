-- Phase 3.4: Dashboard & statistics database access optimization
-- Targets: get_dashboard_statistics_batch, get_statistics_page_bundle, get_store_statistics
-- Strategy: shared catalog KPI scan, hybrid store_daily_stats + live today, auth/core split for benchmarks

-- ---------------------------------------------------------------------------
-- 1) Single-pass merchant catalog KPIs (dashboard + statistics snapshot fields)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._merchant_catalog_kpis(p_owner_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'product_count', COUNT(*) FILTER (WHERE p.archived_at IS NULL)::INT,
    'published_count', COUNT(*) FILTER (
      WHERE p.archived_at IS NULL AND COALESCE(p.is_active, true) = true
    )::INT,
    'low_stock_count', COUNT(*) FILTER (
      WHERE p.archived_at IS NULL
        AND COALESCE(p.is_active, true) = true
        AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock_level, 5)
    )::INT,
    'statistics_product_count', COUNT(*) FILTER (
      WHERE p.archived_at IS NULL AND COALESCE(p.is_active, true) = true
    )::INT
  )
  FROM public.products p
  WHERE p.owner_id = p_owner_id;
$$;

REVOKE ALL ON FUNCTION public._merchant_catalog_kpis(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Core statistics for one period — hybrid rollup (closed days) + live (today)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._get_store_statistics_core(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_catalog JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_today_start TIMESTAMPTZ;
  v_today_date DATE;
  v_closed_end_date DATE;
  v_catalog JSONB;
  v_product_count INT;
  v_low_stock INT;
  v_rollup_orders INT := 0;
  v_rollup_completed INT := 0;
  v_rollup_revenue NUMERIC := 0;
  v_rollup_visits INT := 0;
  v_rollup_unique INT := 0;
  v_live_orders INT := 0;
  v_live_completed INT := 0;
  v_live_revenue NUMERIC := 0;
  v_live_pending INT := 0;
  v_live_visits INT := 0;
  v_live_unique INT := 0;
  v_use_hybrid BOOLEAN := false;
  v_has_closed_rollup BOOLEAN := false;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN NULL;
  END IF;

  v_start_date := (p_start AT TIME ZONE 'UTC')::DATE;
  v_end_date := (p_end AT TIME ZONE 'UTC')::DATE;
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_date := (v_today_start AT TIME ZONE 'UTC')::DATE;
  v_closed_end_date := LEAST(v_end_date, v_today_date - 1);

  v_catalog := COALESCE(p_catalog, public._merchant_catalog_kpis(p_owner_id));
  v_product_count := COALESCE((v_catalog->>'statistics_product_count')::INT, 0);
  v_low_stock := COALESCE((v_catalog->>'low_stock_count')::INT, 0);

  v_use_hybrid := p_end >= v_today_start AND v_start_date < v_today_date;

  IF v_use_hybrid AND v_closed_end_date >= v_start_date THEN
    SELECT EXISTS (
      SELECT 1 FROM public.store_daily_stats sds
      WHERE sds.owner_id = p_owner_id
        AND sds.stat_date >= v_start_date
        AND sds.stat_date <= v_closed_end_date
    ) INTO v_has_closed_rollup;

    IF v_has_closed_rollup THEN
      SELECT
        COALESCE(SUM(sds.order_count - sds.cancelled_order_count), 0)::INT,
        COALESCE(SUM(sds.completed_order_count), 0)::INT,
        COALESCE(SUM(sds.completed_revenue), 0),
        COALESCE(SUM(sds.visit_count), 0)::INT,
        COALESCE(SUM(sds.unique_visitors), 0)::INT
      INTO v_rollup_orders, v_rollup_completed, v_rollup_revenue, v_rollup_visits, v_rollup_unique
      FROM public.store_daily_stats sds
      WHERE sds.owner_id = p_owner_id
        AND sds.stat_date >= v_start_date
        AND sds.stat_date <= v_closed_end_date;
    ELSE
      v_use_hybrid := false;
    END IF;
  ELSE
    v_use_hybrid := false;
  END IF;

  IF NOT v_use_hybrid THEN
    IF p_end < v_today_start AND EXISTS (
      SELECT 1 FROM public.store_daily_stats
      WHERE owner_id = p_owner_id AND stat_date >= v_start_date AND stat_date <= v_end_date
    ) THEN
      SELECT
        COALESCE(SUM(order_count - cancelled_order_count), 0)::INT,
        COALESCE(SUM(completed_order_count), 0)::INT,
        COALESCE(SUM(completed_revenue), 0),
        COALESCE(SUM(visit_count), 0)::INT,
        COALESCE(SUM(unique_visitors), 0)::INT
      INTO v_live_orders, v_live_completed, v_live_revenue, v_live_visits, v_live_unique
      FROM public.store_daily_stats
      WHERE owner_id = p_owner_id
        AND stat_date >= v_start_date
        AND stat_date <= v_end_date;
      v_live_pending := 0;
    ELSE
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
        AND trim(visitor_ip) <> ''
        AND visitor_ip <> '0.0.0.0';
    END IF;
  ELSE
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
      AND created_at >= GREATEST(p_start, v_today_start)
      AND created_at <= p_end;

    SELECT COUNT(*)::INT INTO v_live_visits
    FROM public.store_visits
    WHERE owner_id = p_owner_id
      AND created_at >= GREATEST(p_start, v_today_start)
      AND created_at <= p_end;

    SELECT COUNT(DISTINCT visitor_ip)::INT INTO v_live_unique
    FROM public.store_visits
    WHERE owner_id = p_owner_id
      AND created_at >= GREATEST(p_start, v_today_start)
      AND created_at <= p_end
      AND visitor_ip IS NOT NULL
      AND trim(visitor_ip) <> ''
      AND visitor_ip <> '0.0.0.0';

    v_live_orders := COALESCE(v_rollup_orders, 0) + COALESCE(v_live_orders, 0);
    v_live_completed := COALESCE(v_rollup_completed, 0) + COALESCE(v_live_completed, 0);
    v_live_revenue := COALESCE(v_rollup_revenue, 0) + COALESCE(v_live_revenue, 0);
    v_live_visits := COALESCE(v_rollup_visits, 0) + COALESCE(v_live_visits, 0);
    v_live_unique := GREATEST(COALESCE(v_rollup_unique, 0), COALESCE(v_live_unique, 0));
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'order_count', v_live_orders,
    'completed_order_count', v_live_completed,
    'pending_count', v_live_pending,
    'completed_revenue', v_live_revenue,
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
    'visit_count', v_live_visits,
    'unique_visitors', GREATEST(v_live_unique, v_live_visits),
    'low_stock_count', v_low_stock,
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
          MAX(oi.product_name) AS product_name,
          SUM(oi.quantity)::INT AS units,
          SUM(oi.subtotal)::NUMERIC AS revenue
        FROM public.order_items oi
        INNER JOIN public.orders o ON o.id = oi.order_id AND o.owner_id = oi.owner_id
        WHERE oi.owner_id = p_owner_id
          AND o.status = 'completed'
          AND COALESCE(o.payment_status, '') <> 'refunded'
          AND o.created_at >= p_start AND o.created_at <= p_end
        GROUP BY oi.product_id
        ORDER BY revenue DESC
        LIMIT 6
      ) t
    ), '[]'::jsonb),
    'top_viewed_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.view_count DESC)
      FROM (
        SELECT
          pv.product_id,
          MAX(p.name) AS product_name,
          COUNT(*)::INT AS view_count
        FROM public.product_views pv
        INNER JOIN public.products p ON p.id = pv.product_id
        WHERE pv.owner_id = p_owner_id
          AND pv.created_at >= p_start AND pv.created_at <= p_end
        GROUP BY pv.product_id
        ORDER BY view_count DESC
        LIMIT 6
      ) t
    ), '[]'::jsonb),
    'campaign_attribution', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC)
      FROM (
        SELECT
          COALESCE(NULLIF(trim(o.utm_source), ''), '(direct)') AS source,
          COALESCE(NULLIF(trim(o.utm_medium), ''), '(none)') AS medium,
          COALESCE(NULLIF(trim(o.utm_campaign), ''), '(none)') AS campaign,
          COUNT(*)::INT AS orders,
          COALESCE(SUM(o.total_amount) FILTER (
            WHERE o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
          ), 0) AS revenue
        FROM public.orders o
        WHERE o.owner_id = p_owner_id
          AND o.status <> 'cancelled'
          AND o.created_at >= p_start AND o.created_at <= p_end
        GROUP BY 1, 2, 3
        ORDER BY revenue DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'stats_source', CASE
      WHEN v_use_hybrid THEN 'daily_rollup_plus_live'
      WHEN p_end < v_today_start THEN 'daily_rollup'
      ELSE 'live'
    END
  ));
END;
$$;

REVOKE ALL ON FUNCTION public._get_store_statistics_core(UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Core dashboard batch (benchmark + production body)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._get_dashboard_statistics_batch_core(p_owner_id UUID)
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
  v_scan_start TIMESTAMPTZ;
  v_order_row RECORD;
  v_visit_row RECORD;
  v_rollup RECORD;
  v_static JSONB;
  v_all_time_orders INT;
  v_all_time_revenue NUMERIC;
  v_all_time_visits INT;
  v_all_time_refunds NUMERIC;
BEGIN
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
  v_scan_start := LEAST(v_prev_week_start, v_month_start);

  v_static := public._merchant_catalog_kpis(p_owner_id);

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
  LEFT JOIN public.order_refunds r
    ON r.order_id = o.id AND r.owner_id = p_owner_id AND r.status = 'completed'
  WHERE o.owner_id = p_owner_id
    AND o.created_at >= v_scan_start;

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
    AND sv.created_at >= v_scan_start;

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
      WHERE r.owner_id = p_owner_id
        AND r.status = 'completed'
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = r.order_id
            AND o.owner_id = p_owner_id
            AND o.status = 'completed'
        )
    ), 0)
  INTO v_all_time_orders, v_all_time_revenue, v_all_time_visits, v_all_time_refunds;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
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
      ),
      'catalog_kpis', v_static,
      'workflow_counts', public.count_merchant_orders_by_workflow(
        p_owner_id, NULL, 'all', 'all', 'all', 'all', NULL, NULL, NULL, NULL
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._get_dashboard_statistics_batch_core(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Public RPC wrappers (auth unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_statistics_batch(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;
  RETURN public._get_dashboard_statistics_batch_core(p_owner_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_statistics(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;
  RETURN public._get_store_statistics_core(p_owner_id, p_start, p_end, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_statistics_page_bundle(
  p_owner_id UUID,
  p_current_start TIMESTAMPTZ,
  p_current_end TIMESTAMPTZ,
  p_previous_start TIMESTAMPTZ,
  p_previous_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  v_catalog := public._merchant_catalog_kpis(p_owner_id);

  RETURN jsonb_build_object(
    'current', public._get_store_statistics_core(
      p_owner_id, p_current_start, p_current_end, v_catalog
    ),
    'previous', public._get_store_statistics_core(
      p_owner_id, p_previous_start, p_previous_end, v_catalog
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis_light(p_owner_id UUID)
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
  v_week_start TIMESTAMPTZ;
  v_week_end TIMESTAMPTZ;
  v_order_row RECORD;
  v_catalog JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  v_today_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_end := v_today_start + INTERVAL '1 day' - INTERVAL '1 millisecond';
  v_week_start := date_trunc('week', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_week_end := v_week_start + INTERVAL '7 days' - INTERVAL '1 millisecond';

  SELECT
    COUNT(*) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end AND o.status <> 'cancelled'
    )::INT AS today_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_today_start AND o.created_at <= v_today_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS today_revenue,
    COUNT(*) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end AND o.status <> 'cancelled'
    )::INT AS week_orders,
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.created_at >= v_week_start AND o.created_at <= v_week_end
        AND o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
    ), 0) AS week_revenue
  INTO v_order_row
  FROM public.orders o
  WHERE o.owner_id = p_owner_id
    AND o.created_at >= v_week_start;

  v_catalog := public._merchant_catalog_kpis(p_owner_id);

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'today', jsonb_build_object(
        'order_count', v_order_row.today_orders,
        'revenue', v_order_row.today_revenue
      ),
      'week', jsonb_build_object(
        'order_count', v_order_row.week_orders,
        'revenue', v_order_row.week_revenue
      ),
      'catalog_kpis', v_catalog
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_statistics_batch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics_batch(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.get_statistics_page_bundle(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_statistics_page_bundle(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.get_dashboard_kpis_light(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis_light(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Benchmark RPC (service_role) — multi-merchant dashboard/statistics timing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_benchmark_dashboard_statistics(
  p_merchant_count INT DEFAULT 10,
  p_warm_cache BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN;
  v_owners UUID[];
  v_owner UUID;
  v_started TIMESTAMPTZ;
  v_ms NUMERIC;
  v_results JSONB := '[]'::jsonb;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
  v_prev_start TIMESTAMPTZ;
  v_prev_end TIMESTAMPTZ;
  v_plan JSONB;
  v_count INT := LEAST(GREATEST(COALESCE(p_merchant_count, 10), 1), 500);
BEGIN
  v_allowed :=
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'authenticator');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  IF p_warm_cache THEN
    BEGIN
      PERFORM pg_prewarm('orders');
      PERFORM pg_prewarm('store_visits');
      PERFORM pg_prewarm('store_daily_stats');
      PERFORM pg_prewarm('products');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  SELECT ARRAY_AGG(sub.owner_id ORDER BY sub.owner_id)
  INTO v_owners
  FROM (
    SELECT DISTINCT ss.owner_id
    FROM public.store_settings ss
    WHERE ss.owner_id IS NOT NULL
    LIMIT v_count
  ) sub;

  v_month_start := date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_end := (date_trunc('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC' - INTERVAL '1 millisecond';
  v_prev_start := v_month_start - INTERVAL '1 month';
  v_prev_end := v_month_start - INTERVAL '1 millisecond';

  FOREACH v_owner IN ARRAY COALESCE(v_owners, ARRAY[]::UUID[])
  LOOP
    v_started := clock_timestamp();
    PERFORM public._get_dashboard_statistics_batch_core(v_owner);
    v_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)
      + EXTRACT(SECOND FROM clock_timestamp() - v_started) * 1000;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'owner_id', v_owner,
      'rpc', 'dashboard_batch',
      'ms', round(v_ms, 3)
    ));

    v_started := clock_timestamp();
    PERFORM public._get_store_statistics_core(v_owner, v_month_start, v_month_end, NULL);
    v_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)
      + EXTRACT(SECOND FROM clock_timestamp() - v_started) * 1000;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'owner_id', v_owner,
      'rpc', 'store_statistics',
      'ms', round(v_ms, 3)
    ));

    v_started := clock_timestamp();
    PERFORM public._get_store_statistics_core(v_owner, v_month_start, v_month_end, public._merchant_catalog_kpis(v_owner));
    PERFORM public._get_store_statistics_core(v_owner, v_prev_start, v_prev_end, public._merchant_catalog_kpis(v_owner));
    v_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_started)
      + EXTRACT(SECOND FROM clock_timestamp() - v_started) * 1000;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'owner_id', v_owner,
      'rpc', 'statistics_bundle_core',
      'ms', round(v_ms, 3)
    ));
  END LOOP;

  BEGIN
    EXECUTE format(
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public._get_dashboard_statistics_batch_core(%L::uuid)',
      v_owners[1]
    ) INTO v_plan;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'rpc', 'explain_dashboard_batch',
      'owner_id', v_owners[1],
      'execution_ms', (v_plan->0->>'Execution Time')::numeric,
      'planning_ms', (v_plan->0->>'Planning Time')::numeric
    ));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'benchmark_at', now(),
    'phase', '3.4',
    'merchant_count', COALESCE(array_length(v_owners, 1), 0),
    'paths', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_benchmark_dashboard_statistics(INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_benchmark_dashboard_statistics(INT, BOOLEAN) TO service_role;

-- Extend hot-path EXPLAIN suite
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
      PERFORM pg_prewarm('store_daily_stats');
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
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public._get_dashboard_statistics_batch_core(%L::uuid)',
        v_owner
      )),
      ('merchant_inventory_summary', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.merchant_inventory_summary(%L::uuid)',
        v_owner
      )),
      ('statistics_bundle_core', format(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public._get_store_statistics_core(%L::uuid, %L::timestamptz, %L::timestamptz, public._merchant_catalog_kpis(%L::uuid))',
        v_owner, v_month_start, v_month_end, v_owner
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

ANALYZE public.store_daily_stats;
ANALYZE public.orders;
ANALYZE public.store_visits;
ANALYZE public.products;
ANALYZE public.customers;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (116, 'phase 3.4: dashboard/statistics hybrid rollups, shared catalog KPIs, benchmark RPC')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
