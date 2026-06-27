-- v26: schema sync — custom_domain columns + platform_health_check ok field

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS custom_domain TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_custom_domain
  ON public.store_settings (custom_domain)
  WHERE custom_domain IS NOT NULL;

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 26;
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
  v_message TEXT;
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

  IF NOT public._platform_col_exists('store_settings', 'custom_domain') THEN
    v_missing := array_append(v_missing, 'column:store_settings.custom_domain');
  END IF;

  v_message := CASE
    WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
    WHEN v_version < v_required THEN 'schema_version_outdated'
    ELSE 'ok'
  END;

  RETURN jsonb_build_object(
    'ok', v_message = 'ok',
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(v_missing, ARRAY[]::TEXT[]),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'dashboard_batch', public._platform_fn_exists('get_dashboard_statistics_batch'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'rate_limits', public._platform_fn_exists('check_rpc_rate_limit'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'custom_domain', public._platform_col_exists('store_settings', 'custom_domain')
    ),
    'message', v_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (26, 'schema_sync: custom_domain columns + health check ok field')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
