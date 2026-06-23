-- Proposed improvements v20: dashboard batch RPC, statistics items RPC, health check v20

-- ---------------------------------------------------------------------------
-- 1) Dashboard KPIs in a single round-trip
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
      p_owner_id,
      NULL,
      'all',
      'all',
      'all',
      'all',
      NULL,
      NULL,
      NULL,
      NULL
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_statistics_batch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics_batch(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Order items for statistics (avoid huge IN lists)
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
    INNER JOIN public.orders o
      ON o.id = oi.order_id
      AND o.owner_id = p_owner_id
    WHERE o.status = 'completed'
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
-- 3) platform_health_check v20
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 20;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_store_products_by_slug',
    'get_store_product_by_id',
    'get_checkout_products_by_ids',
    'get_owner_checkout_products_by_ids',
    'get_store_meta',
    'get_owner_products_page',
    'create_order_with_stock_deduction',
    'checkout_resolve_duplicate_order',
    'get_order_by_idempotency_key',
    'resolve_checkout_owner',
    'publish_owner_product',
    'get_merchant_product_reviews',
    'submit_product_review_for_store',
    'product_checkout_available_qty',
    'get_store_statistics',
    'get_dashboard_statistics_batch',
    'get_order_items_for_statistics',
    'get_owner_bootstrap',
    'attach_order_marketing_attribution',
    'list_merchant_orders',
    'count_merchant_orders_by_workflow',
    'list_public_store_slugs',
    'get_storefront_footer_products',
    'submit_access_lead',
    'admin_list_leads',
    'admin_get_lead',
    'increment_product_stock'
  ];
  v_required_cols TEXT[] := ARRAY[
    'products.archived_at',
    'products.is_active',
    'products.variants',
    'products.stock_quantity',
    'products.store_id',
    'orders.idempotency_key',
    'orders.payment_status',
    'orders.delivery_status',
    'orders.store_id',
    'orders.marketing_attribution',
    'store_settings.store_slug',
    'order_items.owner_id',
    'customers.store_id',
    'leads.selected_plan_id',
    'leads.selected_plan_name',
    'leads.governorate',
    'leads.instagram_url',
    'leads.expected_monthly_orders'
  ];
  v_col TEXT;
  v_table TEXT;
  v_column TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

  IF NOT public._platform_table_exists('leads') THEN
    v_missing := array_append(v_missing, 'table:leads');
  END IF;

  IF NOT public._platform_table_exists('store_daily_stats') THEN
    v_missing := array_append(v_missing, 'table:store_daily_stats');
  END IF;

  IF NOT public._platform_table_exists('order_webhook_outbox') THEN
    v_missing := array_append(v_missing, 'table:order_webhook_outbox');
  END IF;

  FOREACH v_fn IN ARRAY v_required_fns LOOP
    IF NOT public._platform_fn_exists(v_fn) THEN
      v_missing := array_append(v_missing, 'function:' || v_fn);
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY v_required_cols LOOP
    v_table := split_part(v_col, '.', 1);
    v_column := split_part(v_col, '.', 2);
    IF NOT public._platform_col_exists(v_table, v_column) THEN
      v_missing := array_append(v_missing, 'column:' || v_col);
    END IF;
  END LOOP;

  IF NOT public._platform_table_exists('stores') THEN
    v_missing := array_append(v_missing, 'table:stores');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images') THEN
    v_missing := array_append(v_missing, 'storage:product-images');
  END IF;

  RETURN jsonb_build_object(
    'ok', COALESCE(array_length(v_missing, 1), 0) = 0 AND v_version >= v_required,
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(to_jsonb(v_missing), '[]'::jsonb),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'checkout_recovery', public._platform_fn_exists('get_order_by_idempotency_key'),
      'dashboard_batch', public._platform_fn_exists('get_dashboard_statistics_batch'),
      'merchant_orders', public._platform_fn_exists('list_merchant_orders'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'sitemap', public._platform_fn_exists('list_public_store_slugs')
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
VALUES (20, 'dashboard batch RPC, statistics order items RPC, health v20')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
