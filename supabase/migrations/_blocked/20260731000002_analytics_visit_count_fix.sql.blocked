-- v100: Fix visitor counts showing zero — flush analytics outbox promptly + correct unique_visitors KPI.

-- ---------------------------------------------------------------------------
-- 1) Merchant-triggered flush (dashboard/statistics load drains pending visits)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flush_merchant_analytics_buffer(p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  v_result := public.process_analytics_event_buffer(GREATEST(1, LEAST(COALESCE(p_limit, 200), 500)));
  RETURN jsonb_build_object('success', true) || COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.flush_merchant_analytics_buffer(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flush_merchant_analytics_buffer(INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Store visit tracking — process buffer after enqueue (no cron required)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_store_visit_by_slug(
  p_store_slug TEXT,
  p_page_path TEXT DEFAULT '/',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_ip TEXT;
  v_path TEXT;
BEGIN
  IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_store_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slug');
  END IF;

  v_owner := public._resolve_store_owner_by_slug(p_store_slug);
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(current_setting('request.headers', true)::json->>'x-real-ip', ''),
    '0.0.0.0'
  );

  v_path := COALESCE(NULLIF(trim(p_page_path), ''), '/');

  IF EXISTS (
    SELECT 1
    FROM public.store_visits sv
    WHERE sv.owner_id = v_owner
      AND sv.visitor_ip = v_ip
      AND sv.page_path = v_path
      AND sv.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM public.analytics_event_outbox o
    WHERE o.owner_id = v_owner
      AND o.event_type = 'store_visit'
      AND o.payload->>'visitor_ip' = v_ip
      AND o.payload->>'page_path' = v_path
      AND o.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  IF NOT public.is_valid_store_visit(v_owner, v_ip) THEN
    RETURN jsonb_build_object('success', true, 'rate_limited', true);
  END IF;

  INSERT INTO public.analytics_event_outbox (owner_id, event_type, payload)
  VALUES (
    v_owner,
    'store_visit',
    jsonb_build_object(
      'visitor_ip', v_ip,
      'page_path', v_path,
      'user_agent', LEFT(p_user_agent, 512),
      'store_slug', lower(trim(p_store_slug))
    )
  );

  PERFORM public.process_analytics_event_buffer(50);

  RETURN jsonb_build_object('success', true, 'buffered', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Product view tracking — same immediate flush
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_product_view_by_slug(
  p_slug TEXT,
  p_product_id UUID,
  p_page_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_ip TEXT;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM public.store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT st.user_id INTO v_owner_id
    FROM public.stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = p_product_id
      AND p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(current_setting('request.headers', true)::json->>'x-real-ip', ''),
    '0.0.0.0'
  );

  IF EXISTS (
    SELECT 1
    FROM public.product_views pv
    WHERE pv.product_id = p_product_id
      AND pv.owner_id = v_owner_id
      AND pv.visitor_ip = v_ip
      AND pv.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM public.analytics_event_outbox o
    WHERE o.owner_id = v_owner_id
      AND o.event_type = 'product_view'
      AND o.payload->>'product_id' = p_product_id::TEXT
      AND o.payload->>'visitor_ip' = v_ip
      AND o.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  INSERT INTO public.analytics_event_outbox (owner_id, event_type, payload)
  VALUES (
    v_owner_id,
    'product_view',
    jsonb_build_object(
      'product_id', p_product_id::TEXT,
      'visitor_ip', v_ip,
      'page_path', NULLIF(trim(p_page_path), ''),
      'store_slug', lower(trim(p_slug))
    )
  );

  PERFORM public.process_analytics_event_buffer(50);

  RETURN jsonb_build_object('success', true, 'buffered', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) get_store_statistics — use live unique count for current/mixed periods
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
      AND trim(visitor_ip) <> ''
      AND visitor_ip <> '0.0.0.0';
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

  RETURN jsonb_strip_nulls(jsonb_build_object(
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
      WHEN v_historical_only THEN v_rollup_unique
      ELSE GREATEST(v_live_unique, v_live_visits)
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
    ), '[]'::jsonb)
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (100, 'analytics visit counts: immediate outbox flush + merchant flush RPC + live unique_visitors KPI')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
