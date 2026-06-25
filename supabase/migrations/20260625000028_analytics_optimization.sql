-- v38: Analytics optimization — skip redundant live scans, refund-aware revenue,
--       statistics page bundle RPC, top-selling products in KPI payload.

-- ---------------------------------------------------------------------------
-- 1) Rollup: adjust completed revenue when payment_status flips to/from refunded
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_orders_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stat_date DATE;
  v_revenue_delta NUMERIC;
  v_completed_delta INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
    IF COALESCE(NEW.status, '') = 'completed' AND COALESCE(NEW.payment_status, '') = 'refunded' THEN
      v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
      UPDATE public.store_daily_stats
      SET completed_revenue = GREATEST(0, completed_revenue - COALESCE(NEW.total_amount, 0)),
          completed_order_count = GREATEST(0, completed_order_count - 1),
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.upsert_store_daily_order_stats(
      OLD.owner_id,
      (OLD.created_at AT TIME ZONE 'UTC')::DATE,
      OLD.status,
      COALESCE(OLD.total_amount, 0),
      -1
    );
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND COALESCE(OLD.total_amount, 0) IS DISTINCT FROM COALESCE(NEW.total_amount, 0) THEN
    v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
    v_revenue_delta := COALESCE(NEW.total_amount, 0) - COALESCE(OLD.total_amount, 0);

    UPDATE public.store_daily_stats
    SET completed_revenue = GREATEST(0, completed_revenue + v_revenue_delta),
        updated_at = NOW()
    WHERE owner_id = NEW.owner_id
      AND stat_date = v_stat_date;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND COALESCE(OLD.payment_status, '') IS DISTINCT FROM COALESCE(NEW.payment_status, '') THEN
    v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
    v_revenue_delta := COALESCE(NEW.total_amount, 0);
    v_completed_delta := 1;

    IF COALESCE(OLD.payment_status, '') <> 'refunded' AND COALESCE(NEW.payment_status, '') = 'refunded' THEN
      UPDATE public.store_daily_stats
      SET completed_revenue = GREATEST(0, completed_revenue - v_revenue_delta),
          completed_order_count = GREATEST(0, completed_order_count - v_completed_delta),
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    ELSIF COALESCE(OLD.payment_status, '') = 'refunded' AND COALESCE(NEW.payment_status, '') <> 'refunded' THEN
      UPDATE public.store_daily_stats
      SET completed_revenue = completed_revenue + v_revenue_delta,
          completed_order_count = completed_order_count + v_completed_delta,
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_daily_stats_trg ON public.orders;
CREATE TRIGGER orders_daily_stats_trg
  AFTER INSERT OR UPDATE OF status, total_amount, payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_orders_daily_stats();

-- ---------------------------------------------------------------------------
-- 2) get_store_statistics — skip live scans for closed historical periods
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
  v_live_visits INT := 0;
  v_live_unique INT := 0;
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
    SELECT COUNT(*)::INT INTO v_live_orders
    FROM orders
    WHERE owner_id = p_owner_id
      AND created_at >= p_start AND created_at <= p_end
      AND status <> 'cancelled';

    SELECT COUNT(*)::INT INTO v_live_completed
    FROM orders
    WHERE owner_id = p_owner_id
      AND created_at >= p_start AND created_at <= p_end
      AND status = 'completed'
      AND COALESCE(payment_status, '') <> 'refunded';

    SELECT COALESCE(SUM(total_amount), 0) INTO v_live_revenue
    FROM orders
    WHERE owner_id = p_owner_id
      AND status = 'completed'
      AND COALESCE(payment_status, '') <> 'refunded'
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
  ELSE
    v_live_orders := v_rollup_orders;
    v_live_completed := v_rollup_completed;
    v_live_revenue := v_rollup_revenue;
    v_live_visits := v_rollup_visits;
    v_live_unique := v_rollup_unique;
  END IF;

  SELECT jsonb_build_object(
    'order_count', CASE WHEN v_historical_only THEN v_rollup_orders ELSE v_live_orders END,
    'completed_order_count', CASE WHEN v_historical_only THEN v_rollup_completed ELSE v_live_completed END,
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id AND status = 'pending'
        AND created_at >= p_start AND created_at <= p_end
    ),
    'completed_revenue', CASE WHEN v_historical_only THEN v_rollup_revenue ELSE v_live_revenue END,
    'refund_total', (
      SELECT COALESCE(SUM(r.amount), 0)
      FROM order_refunds r
      JOIN orders o ON o.id = r.order_id
      WHERE r.owner_id = p_owner_id AND r.status = 'completed'
        AND o.status = 'completed'
        AND o.created_at >= p_start AND o.created_at <= p_end
    ),
    'visit_count', CASE WHEN v_historical_only THEN v_rollup_visits ELSE v_live_visits END,
    'unique_visitors', CASE
      WHEN v_end_date > v_start_date AND v_has_rollup THEN v_rollup_unique
      WHEN v_historical_only THEN v_rollup_unique
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
    'top_selling_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.revenue DESC)
      FROM (
        SELECT
          oi.product_id,
          COALESCE(MAX(oi.product_name), 'منتج') AS product_name,
          COALESCE(SUM(oi.quantity), 0)::INT AS units,
          COALESCE(SUM(oi.subtotal), 0)::NUMERIC AS revenue
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id AND oi.owner_id = o.owner_id
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
          COALESCE(SUM(
            CASE WHEN o.status = 'completed' AND COALESCE(o.payment_status, '') <> 'refunded'
              THEN o.total_amount ELSE 0 END
          ), 0)::NUMERIC AS revenue
        FROM orders o
        WHERE o.owner_id = p_owner_id AND o.created_at >= p_start AND o.created_at <= p_end
          AND o.status <> 'cancelled' AND o.marketing_attribution IS NOT NULL
          AND o.marketing_attribution <> 'null'::jsonb
        GROUP BY 1, 2, 3 ORDER BY orders DESC LIMIT 20
      ) t
    ), '[]'::jsonb),
    'stats_source', CASE WHEN v_historical_only THEN 'daily_rollup' ELSE 'live' END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Statistics page bundle — one round-trip for current + previous KPIs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_statistics_page_bundle(
  p_owner_id UUID,
  p_current_start TIMESTAMPTZ,
  p_current_end TIMESTAMPTZ,
  p_previous_start TIMESTAMPTZ,
  p_previous_end TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'current', public.get_store_statistics(p_owner_id, p_current_start, p_current_end),
    'previous', public.get_store_statistics(p_owner_id, p_previous_start, p_previous_end)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_statistics_page_bundle(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_statistics_page_bundle(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) order_items RPC — exclude refunded completed orders
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
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.owner_id = p_owner_id
      AND o.status = 'completed'
      AND COALESCE(o.payment_status, '') <> 'refunded'
      AND o.created_at >= p_start
      AND o.created_at <= p_end
    ORDER BY oi.created_at DESC
    LIMIT v_limit
  ) sub;

  RETURN COALESCE(v_items, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_items_for_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_items_for_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Dashboard batch — refund-aware completed revenue in live scan
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
    'workflow_counts', (
      SELECT jsonb_build_object(
        'all', COUNT(*)::INT,
        'new', COUNT(*) FILTER (WHERE status = 'pending')::INT,
        'processing', COUNT(*) FILTER (WHERE status = 'processing')::INT,
        'paid', COUNT(*) FILTER (WHERE status = 'paid')::INT,
        'delivered', COUNT(*) FILTER (WHERE status = 'delivered')::INT
      )
      FROM public.orders
      WHERE owner_id = p_owner_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_statistics_batch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics_batch(UUID) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (38, 'analytics_optimization: bundle RPC, rollup-only scans, refund-aware revenue, top sellers in KPI')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
