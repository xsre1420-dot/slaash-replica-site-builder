-- v37: Re-apply tenant isolation locks (idempotent) + close internal RPC exposure

-- ---------------------------------------------------------------------------
-- 1) checkout_resolve_duplicate_order — internal only (cross-tenant probe fix)
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
-- 2) merchant_orders_base_filter — authenticated merchants only (defense in depth)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.merchant_orders_base_filter(
  uuid, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_orders_base_filter(
  uuid, text, text, text, text, text, timestamptz, timestamptz, numeric, numeric
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) get_store_for_user — enforce caller identity (IDOR guard)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_for_user(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT json_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'store_name', s.store_name,
      'store_slug', s.store_slug,
      'theme_id', COALESCE(s.theme_id, 'default')
    )
    FROM public.stores s
    WHERE s.user_id = p_user_id
    LIMIT 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_for_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_for_user(UUID) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (37, 'tenant_isolation_reapply: lock checkout_resolve, merchant_orders_base_filter, get_store_for_user')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
