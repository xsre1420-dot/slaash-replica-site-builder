-- Public preview for login step 1 — same hash path as admin_generate (no edge dependency).

CREATE OR REPLACE FUNCTION public.preview_merchant_access_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code public.merchant_access_codes%ROWTYPE;
  v_hash TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF COALESCE(NULLIF(trim(p_code), ''), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  v_hash := public.hash_access_code(trim(p_code));

  SELECT mac.* INTO v_code
  FROM public.merchant_access_codes mac
  WHERE mac.code_hash = v_hash
  LIMIT 1;

  IF v_code.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_code.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_revoked');
  END IF;

  IF v_code.status = 'active'
     AND v_code.code_expires_at IS NOT NULL
     AND v_code.code_expires_at < v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_expired');
  END IF;

  IF v_code.status = 'active'
     AND v_code.subscription_end_at IS NOT NULL
     AND v_code.subscription_end_at < v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_expired');
  END IF;

  IF v_code.status = 'expired' AND v_code.redeemed_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_expired');
  END IF;

  IF v_code.status NOT IN ('active', 'redeemed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_expired');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'preview', true,
    'plan_id', v_code.plan_id,
    'duration_months', v_code.duration_months,
    'agreed_price', v_code.agreed_price,
    'store_name', v_code.store_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_merchant_access_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_merchant_access_code(TEXT) TO anon, authenticated;
