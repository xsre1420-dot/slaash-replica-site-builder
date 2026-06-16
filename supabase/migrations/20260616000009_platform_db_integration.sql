-- Platform ↔ database integration contract + health diagnostics

CREATE TABLE IF NOT EXISTS public.platform_schema_version (
  version INT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

INSERT INTO public.platform_schema_version (version, notes)
VALUES (9, 'platform_db_integration_health_check')
ON CONFLICT (version) DO UPDATE
SET applied_at = NOW(), notes = EXCLUDED.notes;

CREATE OR REPLACE FUNCTION public._platform_fn_exists(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = p_name
  );
$$;

CREATE OR REPLACE FUNCTION public._platform_col_exists(p_table TEXT, p_column TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
      AND c.column_name = p_column
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 9;
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
    'product_checkout_available_qty'
  ];
  v_required_cols TEXT[] := ARRAY[
    'products.archived_at',
    'products.is_active',
    'products.variants',
    'products.stock_quantity',
    'orders.idempotency_key',
    'store_settings.store_slug'
  ];
  v_col TEXT;
  v_table TEXT;
  v_column TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

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

  RETURN jsonb_build_object(
    'ok', COALESCE(array_length(v_missing, 1), 0) = 0 AND v_version >= v_required,
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(to_jsonb(v_missing), '[]'::jsonb),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'merchant_catalog', public._platform_fn_exists('get_owner_products_page'),
      'publish', public._platform_fn_exists('publish_owner_product'),
      'reviews', public._platform_fn_exists('get_merchant_product_reviews')
    ),
    'message', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
      WHEN v_version < v_required THEN 'schema_version_outdated'
      ELSE 'ok'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_health_check() TO anon, authenticated;
