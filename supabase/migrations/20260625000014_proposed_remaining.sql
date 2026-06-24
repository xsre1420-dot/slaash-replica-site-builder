-- Remaining proposed improvements v24: rollup dashboard, stats fix, store_id, security, rate limits

-- Allow rate-limit helper from storefront/checkout RPCs
GRANT EXECUTE ON FUNCTION public.check_rpc_rate_limit(TEXT, INT, INT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1) Fix get_store_statistics: rollup presence + multi-day unique_visitors
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
      WHEN v_end_date > v_start_date THEN v_live_unique
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
-- 2) Dashboard batch: still one RPC but benefits from fixed get_store_statistics
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

  RETURN jsonb_build_object(
    'today', public.get_store_statistics(p_owner_id, v_today_start, v_today_end),
    'yesterday', public.get_store_statistics(p_owner_id, v_yesterday_start, v_yesterday_end),
    'week', public.get_store_statistics(p_owner_id, v_week_start, v_week_end),
    'previous_week', public.get_store_statistics(p_owner_id, v_prev_week_start, v_prev_week_end),
    'month', public.get_store_statistics(p_owner_id, v_month_start, v_month_end),
    'all_time', public.get_store_statistics(p_owner_id, '2000-01-01T00:00:00Z'::timestamptz, v_now),
    'workflow_counts', public.count_merchant_orders_by_workflow(
      p_owner_id, NULL, 'all', 'all', 'all', 'all', NULL, NULL, NULL, NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_statistics_batch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics_batch(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Backfill store_id on tenant tables
-- ---------------------------------------------------------------------------
UPDATE public.products p
SET store_id = s.id
FROM public.stores s
WHERE p.owner_id = s.user_id AND p.store_id IS NULL;

UPDATE public.orders o
SET store_id = s.id
FROM public.stores s
WHERE o.owner_id = s.user_id AND o.store_id IS NULL;

UPDATE public.categories c
SET store_id = s.id
FROM public.stores s
WHERE c.owner_id = s.user_id AND c.store_id IS NULL;

UPDATE public.customers cu
SET store_id = s.id
FROM public.stores s
WHERE cu.owner_id = s.user_id AND cu.store_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4) submit_access_lead rate limit (10/hour per phone) — preserve 7-arg contract
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_access_lead(
  p_full_name TEXT,
  p_whatsapp_number TEXT,
  p_source TEXT DEFAULT 'website',
  p_selected_plan_id TEXT DEFAULT NULL,
  p_governorate TEXT DEFAULT NULL,
  p_instagram_url TEXT DEFAULT NULL,
  p_expected_monthly_orders TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_lead_id UUID;
  v_plan_id TEXT;
  v_plan_name TEXT;
  v_governorate TEXT;
  v_instagram TEXT;
  v_orders TEXT;
  v_ip TEXT;
BEGIN
  v_name := trim(COALESCE(p_full_name, ''));
  v_phone := public.normalize_whatsapp_number(p_whatsapp_number);
  v_plan_id := NULLIF(trim(COALESCE(p_selected_plan_id, '')), '');
  v_governorate := NULLIF(trim(COALESCE(p_governorate, '')), '');
  v_instagram := NULLIF(trim(COALESCE(p_instagram_url, '')), '');
  v_orders := NULLIF(trim(COALESCE(p_expected_monthly_orders, '')), '');

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    '0.0.0.0'
  );

  IF v_phone IS NOT NULL AND NOT public.check_rpc_rate_limit('lead:' || v_ip || ':' || v_phone, 10, 3600) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  IF length(v_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_name');
  END IF;
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_whatsapp');
  END IF;
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;
  IF v_governorate IS NULL OR length(v_governorate) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_governorate');
  END IF;
  IF v_orders IS NULL OR length(v_orders) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_monthly_orders');
  END IF;

  SELECT sp.name INTO v_plan_name
  FROM public.subscription_plans sp
  WHERE sp.id = v_plan_id AND sp.is_active = true;

  IF v_plan_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  INSERT INTO public.leads (
    full_name,
    whatsapp_number,
    source,
    status,
    selected_plan_id,
    selected_plan_name,
    governorate,
    instagram_url,
    expected_monthly_orders
  )
  VALUES (
    v_name,
    v_phone,
    COALESCE(NULLIF(trim(p_source), ''), 'website'),
    'new',
    v_plan_id,
    v_plan_name,
    v_governorate,
    v_instagram,
    v_orders
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Hide owner_id from anonymous get_store_meta responses
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_meta(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store JSONB;
  v_categories JSONB;
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'owner_id', s.owner_id,
    'store_name', s.store_name,
    'store_logo', s.store_logo,
    'store_slug', s.store_slug,
    'menu_background_color', s.menu_background_color,
    'menu_text_color', s.menu_text_color,
    'menu_accent_color', s.menu_accent_color,
    'store_font', COALESCE(s.store_font, 'Tajawal'),
    'banner_images', s.banner_images,
    'primary_banner_index', s.primary_banner_index,
    'delivery_prices', s.delivery_prices,
    'whatsapp_number', s.whatsapp_number,
    'facebook_url', s.facebook_url,
    'instagram_url', s.instagram_url,
    'return_policy', s.return_policy,
    'privacy_policy', s.privacy_policy,
    'payment_methods', s.payment_methods
  ) INTO v_store
  FROM store_settings s
  WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_store IS NULL THEN
    SELECT jsonb_build_object(
      'owner_id', st.user_id,
      'store_name', st.store_name,
      'store_logo', NULL,
      'store_slug', st.store_slug,
      'menu_background_color', '#ffffff',
      'menu_text_color', '#333333',
      'menu_accent_color', '#6366f1',
      'store_font', 'Tajawal',
      'banner_images', '[]'::jsonb,
      'primary_banner_index', 0,
      'delivery_prices', '[]'::jsonb,
      'whatsapp_number', NULL,
      'facebook_url', NULL,
      'instagram_url', NULL,
      'return_policy', NULL,
      'privacy_policy', NULL,
      'payment_methods', '["cash_on_delivery"]'::jsonb
    ) INTO v_store
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  v_owner_id := (v_store->>'owner_id')::UUID;

  IF auth.uid() IS NULL THEN
    v_store := v_store - 'owner_id';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', c.id, 'name', c.name, 'display_order', c.display_order)
    ORDER BY c.display_order ASC
  ), '[]'::jsonb)
  INTO v_categories
  FROM categories c
  WHERE c.owner_id = v_owner_id;

  RETURN jsonb_build_object('store', v_store, 'categories', v_categories);
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_meta(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_meta(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Reviews: force RPC-only path for anon
-- ---------------------------------------------------------------------------
REVOKE INSERT ON public.product_reviews FROM anon;

-- ---------------------------------------------------------------------------
-- 7) Drop redundant indexes (safe after verification)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_orders_owner_created_at;
DROP INDEX IF EXISTS idx_orders_owner_id;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_products_owner_id;
DROP INDEX IF EXISTS idx_store_settings_owner_id;

-- ---------------------------------------------------------------------------
-- 8) platform_health_check v24
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 24;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_storefront_page_bundle',
    'get_dashboard_statistics_batch',
    'get_store_statistics',
    'create_order_with_stock_deduction',
    'check_rpc_rate_limit',
    'submit_access_lead',
    'list_merchant_orders',
    'track_store_visit_by_slug'
  ];
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

  FOREACH v_fn IN ARRAY v_required_fns LOOP
    IF NOT public._platform_fn_exists(v_fn) THEN
      v_missing := array_append(v_missing, v_fn);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(v_missing, ARRAY[]::TEXT[]),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'dashboard_batch', public._platform_fn_exists('get_dashboard_statistics_batch'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'rate_limits', public._platform_fn_exists('check_rpc_rate_limit'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction')
    ),
    'message', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
      WHEN v_version < v_required THEN 'schema_version_outdated'
      ELSE 'ok'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (24, 'proposed_remaining: stats rollup fix, store_id backfill, leads rate limit, security')
ON CONFLICT (version) DO NOTHING;
