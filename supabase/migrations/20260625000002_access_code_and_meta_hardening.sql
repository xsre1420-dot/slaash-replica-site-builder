-- Stop storing plaintext auth passwords in merchant_access_codes.
-- Passwords are provisioned ephemerally in redeem-access-code edge function only.

UPDATE public.merchant_access_codes
SET auth_password = '', updated_at = NOW()
WHERE auth_password IS NOT NULL AND auth_password <> '';

COMMENT ON COLUMN public.merchant_access_codes.auth_password IS
  'Deprecated — no longer stored. Auth passwords are set ephemerally during redeem.';

CREATE OR REPLACE FUNCTION public.admin_generate_access_code(
  p_lead_id UUID,
  p_plan_id TEXT DEFAULT 'annual',
  p_agreed_price INTEGER DEFAULT NULL,
  p_store_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lead RECORD;
  v_plan RECORD;
  v_record_id UUID := gen_random_uuid();
  v_plain_code TEXT;
  v_code_hash TEXT;
  v_auth_email TEXT;
  v_username TEXT;
  v_store_name TEXT;
  v_duration INT;
  v_price INT;
  v_no_expiry TIMESTAMPTZ := TIMESTAMPTZ '2099-12-31 23:59:59+00';
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_plan_id NOT IN ('annual', 'yearly') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  SELECT l.id, l.full_name, l.whatsapp_number, l.converted_user_id, l.selected_plan_name
  INTO v_lead
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_not_found');
  END IF;

  IF v_lead.converted_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_already_converted');
  END IF;

  SELECT sp.id, sp.name, sp.billing_interval_months
  INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = p_plan_id AND sp.is_active = true;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  v_duration := CASE WHEN p_plan_id = 'yearly' THEN 12 ELSE 6 END;
  v_plain_code := 'BDY-' || public._access_code_random_part(4) || '-' || public._access_code_random_part(4);
  v_code_hash := public.hash_access_code(v_plain_code);
  v_auth_email := v_record_id::TEXT || '@access.slaash.internal';
  v_username := 'store' || (10000 + floor(random() * 90000)::INT)::TEXT;
  v_store_name := COALESCE(NULLIF(trim(p_store_name), ''), v_lead.full_name, 'متجري');
  v_price := COALESCE(p_agreed_price, CASE WHEN p_plan_id = 'yearly' THEN 220000 ELSE 125000 END);

  INSERT INTO public.merchant_access_codes (
    id,
    lead_id,
    code_hash,
    code_hint,
    auth_email,
    auth_password,
    plan_id,
    duration_months,
    agreed_price,
    store_name,
    username,
    status,
    code_expires_at,
    notes,
    created_by
  )
  VALUES (
    v_record_id,
    p_lead_id,
    v_code_hash,
    right(replace(v_plain_code, '-', ''), 4),
    v_auth_email,
    '',
    p_plan_id,
    v_duration,
    v_price,
    v_store_name,
    v_username,
    'active',
    v_no_expiry,
    NULLIF(trim(p_notes), ''),
    auth.uid()
  );

  UPDATE public.leads
  SET status = 'interested', admin_read_at = NOW()
  WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'success', true,
    'access_code', v_plain_code,
    'lead_id', p_lead_id,
    'customer_name', v_lead.full_name,
    'whatsapp_number', v_lead.whatsapp_number,
    'plan_id', p_plan_id,
    'plan_label', v_plan.name,
    'duration_months', v_duration,
    'agreed_price', v_price,
    'code_expires_at', v_no_expiry,
    'message',
      format(
        'مرحباً %s — رمز الدخول: %s — المدة: %s أشهر — السعر: %s د.ع — ادخل من /login والصق الرمز',
        v_lead.full_name,
        v_plain_code,
        v_duration,
        to_char(v_price, 'FM999,999,999')
      )
  );
END;
$$;

-- Verify order belongs to store before Meta conversion events (used by edge function)
CREATE OR REPLACE FUNCTION public.verify_order_for_meta_conversion(
  p_order_id UUID,
  p_owner_id UUID,
  p_expected_total DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF p_order_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_payload');
  END IF;

  SELECT o.id, o.owner_id, o.total_amount, o.created_at
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.owner_id = p_owner_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_order.created_at < NOW() - INTERVAL '7 days' THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_too_old');
  END IF;

  IF p_expected_total IS NOT NULL AND ABS(v_order.total_amount - p_expected_total) > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_mismatch');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'total_amount', v_order.total_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_order_for_meta_conversion(UUID, UUID, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_order_for_meta_conversion(UUID, UUID, DECIMAL) TO service_role;
