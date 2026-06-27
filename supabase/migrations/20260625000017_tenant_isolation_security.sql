-- v27: Multi-tenant isolation hardening — lock down cross-tenant RPC probes

-- ---------------------------------------------------------------------------
-- 1) checkout_resolve_duplicate_order — internal only (not callable by clients)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_resolve_duplicate_order(
  p_owner_id UUID,
  p_idempotency_key TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_total NUMERIC;
BEGIN
  IF p_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT o.id, o.total_amount
    INTO v_id, v_total
    FROM public.orders o
    WHERE o.owner_id = p_owner_id
      AND o.idempotency_key = trim(p_idempotency_key)
    LIMIT 1;
  ELSIF p_order_id IS NOT NULL THEN
    SELECT o.id, o.total_amount
    INTO v_id, v_total
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.owner_id = p_owner_id
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_id,
    'total_amount', COALESCE(v_total, 0),
    'idempotent', true,
    'message', 'Order already exists'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_resolve_duplicate_order(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_resolve_duplicate_order(UUID, TEXT, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) get_order_by_idempotency_key — anon must use slug; auth must match owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_by_idempotency_key(
  p_idempotency_key TEXT,
  p_owner_id UUID DEFAULT NULL,
  p_store_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_order RECORD;
  v_ip TEXT;
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    '0.0.0.0'
  );

  IF auth.uid() IS NOT NULL THEN
    IF p_owner_id IS NOT NULL AND auth.uid() <> p_owner_id THEN
      RETURN jsonb_build_object('found', false);
    END IF;
    v_owner_id := auth.uid();
  ELSE
    IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_store_slug !~ '^[a-z0-9-]+$' THEN
      RETURN jsonb_build_object('found', false);
    END IF;
    BEGIN
      v_owner_id := public.resolve_checkout_owner(NULL, trim(p_store_slug));
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('found', false);
    END;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF NOT public.check_rpc_rate_limit(
    'checkout-recover:' || v_ip || ':' || v_owner_id::text,
    30,
    3600
  ) THEN
    RETURN jsonb_build_object('found', false, 'error', 'rate_limited');
  END IF;

  SELECT o.id, o.total_amount, o.status, o.created_at
  INTO v_order
  FROM public.orders o
  WHERE o.owner_id = v_owner_id
    AND o.idempotency_key = trim(p_idempotency_key)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'order_id', v_order.id,
    'total_amount', v_order.total_amount,
    'status', v_order.status,
    'created_at', v_order.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_idempotency_key(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_idempotency_key(TEXT, UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) is_payment_method_allowed — block authenticated cross-tenant probing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_payment_method_allowed(
  p_owner_id UUID,
  p_payment_method TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_methods JSONB;
  v_method TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_id THEN
    RETURN false;
  END IF;

  v_method := COALESCE(NULLIF(trim(p_payment_method), ''), 'cash_on_delivery');

  IF v_method = 'credit_card' THEN
    RETURN false;
  END IF;

  SELECT payment_methods INTO v_methods
  FROM store_settings
  WHERE owner_id = p_owner_id;

  IF v_methods IS NULL OR jsonb_typeof(v_methods) <> 'array' OR jsonb_array_length(v_methods) = 0 THEN
    RETURN v_method = 'cash_on_delivery';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_methods) AS m(val)
    WHERE m.val = v_method
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_payment_method_allowed(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_payment_method_allowed(UUID, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) increment_product_stock — enforce store_id membership when present
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_product_stock(
  p_product_id UUID,
  p_owner_id UUID,
  p_delta INT,
  p_reason TEXT DEFAULT 'restock'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INT;
  v_variants JSONB;
  v_new_qty INT;
  v_store_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_delta IS NULL OR p_delta <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_delta');
  END IF;

  SELECT stock_quantity, variants, store_id
  INTO v_stock, v_variants, v_store_id
  FROM public.products
  WHERE id = p_product_id
    AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_store_id IS NOT NULL AND v_store_id NOT IN (SELECT public.auth_user_store_ids()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_new_qty := COALESCE(v_stock, 0) + p_delta;

  PERFORM set_config('app.skip_stock_sync', 'on', true);

  IF v_variants IS NOT NULL
     AND jsonb_typeof(v_variants) = 'array'
     AND jsonb_array_length(v_variants) > 0 THEN
    v_variants := public.scale_variants_to_total(v_variants, v_new_qty);
  END IF;

  UPDATE public.products
  SET stock_quantity = v_new_qty,
      variants = v_variants,
      updated_at = NOW()
  WHERE id = p_product_id
    AND owner_id = p_owner_id;

  PERFORM set_config('app.skip_stock_sync', 'off', true);

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
  VALUES (p_product_id, p_owner_id, p_delta, COALESCE(NULLIF(trim(p_reason), ''), 'restock'));

  RETURN jsonb_build_object('success', true, 'stock_quantity', v_new_qty);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.skip_stock_sync', 'off', true);
  RETURN jsonb_build_object('success', false, 'error', 'restock_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.increment_product_stock(UUID, UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(UUID, UUID, INT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Tighten tenant_row_owned — require store match when store_id is set
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tenant_row_owned(p_owner_id UUID, p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_owner_id = auth.uid()
    AND (
      (p_store_id IS NOT NULL AND p_store_id IN (SELECT public.auth_user_store_ids()))
      OR (
        p_store_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.stores s WHERE s.user_id = auth.uid()
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 6) Storage — drop duplicate public read policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 7) platform_health_check v27
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 27;
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
    'track_store_visit_by_slug',
    'tenant_row_owned',
    'get_order_by_idempotency_key'
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
      'tenant_isolation', public._platform_fn_exists('tenant_row_owned'),
      'custom_domain', public._platform_col_exists('store_settings', 'custom_domain')
    ),
    'message', v_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (27, 'tenant_isolation: lock checkout probe RPCs, tighten tenant_row_owned, reviews INSERT')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
