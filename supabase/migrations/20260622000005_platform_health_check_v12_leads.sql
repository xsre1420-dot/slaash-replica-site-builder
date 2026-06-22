-- Health check v12: verify leads capture schema + submit_access_lead RPC

INSERT INTO public.platform_schema_version (version, notes)
VALUES (12, 'Leads table extended fields + submit_access_lead 7-arg RPC')
ON CONFLICT (version) DO UPDATE
SET applied_at = NOW(), notes = EXCLUDED.notes;

DROP FUNCTION IF EXISTS public.platform_health_check();

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 12;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_store_products_by_slug',
    'get_store_product_by_id',
    'get_store_meta',
    'get_owner_products_page',
    'create_order_with_stock_deduction',
    'resolve_checkout_owner',
    'publish_owner_product',
    'get_merchant_product_reviews',
    'submit_product_review_for_store',
    'product_checkout_available_qty',
    'get_store_statistics',
    'get_owner_bootstrap',
    'attach_order_marketing_attribution',
    'list_merchant_orders',
    'count_merchant_orders_by_workflow',
    'get_storefront_footer_products',
    'submit_access_lead',
    'admin_list_leads',
    'admin_get_lead'
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
    'store_settings.store_slug',
    'order_items.owner_id',
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
      'merchant_catalog', public._platform_fn_exists('get_owner_products_page'),
      'merchant_orders', public._platform_fn_exists('list_merchant_orders'),
      'publish', public._platform_fn_exists('publish_owner_product'),
      'reviews', public._platform_fn_exists('get_merchant_product_reviews'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'leads_submit', public._platform_fn_exists('submit_access_lead'),
      'leads_admin', public._platform_fn_exists('admin_list_leads')
    ),
    'message', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
      WHEN v_version < v_required THEN 'schema_version_outdated'
      ELSE 'ok'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO anon, authenticated, service_role;
