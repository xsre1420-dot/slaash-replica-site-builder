-- v33: Schema ↔ code synchronization — orders columns, health check, index cleanup

-- ---------------------------------------------------------------------------
-- 1) orders columns referenced by RPCs + orderService selects but missing on
--    fresh installs (reconcile migration created orders without these columns)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS delivery_time INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS customer_governorate TEXT,
  ADD COLUMN IF NOT EXISTS meta_conversion_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.notes IS 'Checkout customer notes — used by create_order_with_stock_deduction';
COMMENT ON COLUMN public.orders.meta_conversion_sent_at IS 'Meta CAPI dedup — set by mark_meta_conversion_sent';

-- ---------------------------------------------------------------------------
-- 2) Redundant idempotency index (same partial unique constraint)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_orders_idempotency_owner;

-- ---------------------------------------------------------------------------
-- 3) platform_health_check v33 — align with migrations v28–v32
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 33;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_storefront_page_bundle',
    'get_store_meta',
    '_resolve_store_owner_by_slug',
    'get_dashboard_statistics_batch',
    'get_store_statistics',
    'create_order_with_stock_deduction',
    'get_order_by_idempotency_key',
    'check_rpc_rate_limit',
    'submit_access_lead',
    'list_merchant_orders',
    'track_store_visit_by_slug',
    'tenant_row_owned',
    'increment_product_stock',
    'verify_order_for_meta_conversion',
    'mark_meta_conversion_sent',
    'storefront_product_json'
  ];
  v_required_cols TEXT[] := ARRAY[
    'orders.notes',
    'orders.meta_conversion_sent_at',
    'orders.idempotency_key',
    'orders.customer_governorate',
    'store_settings.store_slug',
    'store_settings.custom_domain',
    'products.archived_at',
    'products.variants',
    'products.stock_quantity'
  ];
  v_col TEXT;
  v_table TEXT;
  v_column TEXT;
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

  FOREACH v_col IN ARRAY v_required_cols LOOP
    v_table := split_part(v_col, '.', 1);
    v_column := split_part(v_col, '.', 2);
    IF NOT public._platform_col_exists(v_table, v_column) THEN
      v_missing := array_append(v_missing, 'column:' || v_col);
    END IF;
  END LOOP;

  IF NOT public._platform_table_exists('store_visitor_daily_keys') THEN
    v_missing := array_append(v_missing, 'table:store_visitor_daily_keys');
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
      'storefront', public._platform_fn_exists('get_storefront_page_bundle'),
      'slug_resolver', public._platform_fn_exists('_resolve_store_owner_by_slug'),
      'dashboard_batch', public._platform_fn_exists('get_dashboard_statistics_batch'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'rate_limits', public._platform_fn_exists('check_rpc_rate_limit'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'tenant_isolation', public._platform_fn_exists('tenant_row_owned'),
      'visit_rollup', public._platform_table_exists('store_visitor_daily_keys'),
      'order_notes', public._platform_col_exists('orders', 'notes'),
      'meta_conversion', public._platform_fn_exists('mark_meta_conversion_sent')
    ),
    'message', v_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

ANALYZE public.orders;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (33, 'schema_code_sync: orders notes/meta cols, health v33, idempotency index cleanup')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
