-- Allow admins to reissue access codes for already-converted (active subscription) leads.

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
  v_plan_id TEXT;
  v_no_expiry TIMESTAMPTZ := TIMESTAMPTZ '2099-12-31 23:59:59+00';
  v_attempt INT := 0;
  v_existing RECORD;
  v_last_plan_id TEXT;
  v_last_duration INT;
  v_last_price INT;
  v_last_store_name TEXT;
  v_last_username TEXT;
  v_is_reissue BOOLEAN := false;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT l.id, l.full_name, l.whatsapp_number, l.converted_user_id, l.selected_plan_name
  INTO v_lead
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_not_found');
  END IF;

  SELECT mac.id, mac.code_hint, mac.plan_id, mac.duration_months, mac.agreed_price, mac.created_at
  INTO v_existing
  FROM public.merchant_access_codes mac
  WHERE mac.lead_id = p_lead_id AND mac.status = 'active'
  ORDER BY mac.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'active_code_exists',
      'code_id', v_existing.id,
      'code_hint', v_existing.code_hint,
      'plan_id', v_existing.plan_id,
      'duration_months', v_existing.duration_months,
      'agreed_price', v_existing.agreed_price,
      'created_at', v_existing.created_at
    );
  END IF;

  v_is_reissue := v_lead.converted_user_id IS NOT NULL;

  IF v_is_reissue THEN
    SELECT mac.plan_id, mac.duration_months, mac.agreed_price, mac.store_name, mac.username
    INTO v_last_plan_id, v_last_duration, v_last_price, v_last_store_name, v_last_username
    FROM public.merchant_access_codes mac
    WHERE mac.lead_id = p_lead_id AND mac.status = 'redeemed'
    ORDER BY mac.redeemed_at DESC NULLS LAST, mac.created_at DESC
    LIMIT 1;

    IF v_last_plan_id IS NULL THEN
      SELECT s.plan_name, COALESCE(sp.billing_interval_months, 6)
      INTO v_last_plan_id, v_last_duration
      FROM public.subscriptions s
      LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_name
      WHERE s.user_id = v_lead.converted_user_id
      ORDER BY s.created_at DESC
      LIMIT 1;
    END IF;

    v_plan_id := COALESCE(NULLIF(trim(p_plan_id), ''), v_last_plan_id, 'annual');
  ELSE
    v_plan_id := COALESCE(NULLIF(trim(p_plan_id), ''), 'annual');
  END IF;

  IF v_plan_id NOT IN ('annual', 'yearly') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  SELECT sp.id, sp.name, sp.billing_interval_months
  INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = v_plan_id AND sp.is_active = true;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  v_duration := COALESCE(
    v_last_duration,
    CASE WHEN v_plan_id = 'yearly' THEN 12 ELSE 6 END
  );
  v_price := COALESCE(
    p_agreed_price,
    v_last_price,
    CASE WHEN v_plan_id = 'yearly' THEN 220000 ELSE 125000 END
  );
  v_store_name := COALESCE(
    NULLIF(trim(p_store_name), ''),
    v_last_store_name,
    v_lead.full_name,
    'متجري'
  );
  v_username := COALESCE(
    v_last_username,
    'store' || (10000 + floor(random() * 90000)::INT)::TEXT
  );

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 12 THEN
      RETURN jsonb_build_object('success', false, 'error', 'generate_failed');
    END IF;

    v_record_id := gen_random_uuid();
    v_plain_code := 'BDY-' || public._access_code_random_part(4) || '-' || public._access_code_random_part(4);
    v_code_hash := public.hash_access_code(v_plain_code);
    v_auth_email := v_record_id::TEXT || '@access.slaash.internal';

    BEGIN
      INSERT INTO public.merchant_access_codes (
        id, lead_id, code_hash, code_hint, auth_email, auth_password,
        plan_id, duration_months, agreed_price, store_name, username,
        status, code_expires_at, notes, created_by
      )
      VALUES (
        v_record_id, p_lead_id, v_code_hash, right(replace(v_plain_code, '-', ''), 4),
        v_auth_email, '', v_plan_id, v_duration, v_price, v_store_name, v_username,
        'active', v_no_expiry,
        COALESCE(NULLIF(trim(p_notes), ''), CASE WHEN v_is_reissue THEN 'reissued for active customer' ELSE NULL END),
        auth.uid()
      );
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = p_lead_id AND mac.status = 'active'
        ) THEN
          RETURN jsonb_build_object('success', false, 'error', 'active_code_exists');
        END IF;
        CONTINUE;
    END;
  END LOOP;

  IF NOT v_is_reissue THEN
    UPDATE public.leads SET status = 'interested', admin_read_at = NOW() WHERE id = p_lead_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'access_code', v_plain_code,
    'code_id', v_record_id,
    'lead_id', p_lead_id,
    'plan_id', v_plan_id,
    'plan_label', v_plan.name,
    'duration_months', v_duration,
    'agreed_price', v_price,
    'code_expires_at', v_no_expiry,
    'reissued', v_is_reissue
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replace_lead_access_code(
  p_lead_id UUID,
  p_code_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lead RECORD;
  v_old RECORD;
  v_plan RECORD;
  v_record_id UUID := gen_random_uuid();
  v_plain_code TEXT;
  v_code_hash TEXT;
  v_auth_email TEXT;
  v_username TEXT;
  v_no_expiry TIMESTAMPTZ := TIMESTAMPTZ '2099-12-31 23:59:59+00';
  v_attempt INT := 0;
  v_reason TEXT := COALESCE(NULLIF(trim(p_reason), ''), 'replaced by admin');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT l.id, l.full_name, l.converted_user_id INTO v_lead FROM public.leads l WHERE l.id = p_lead_id;
  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_not_found');
  END IF;

  SELECT mac.id, mac.plan_id, mac.duration_months, mac.agreed_price, mac.store_name, mac.code_hint, mac.username
  INTO v_old
  FROM public.merchant_access_codes mac
  WHERE mac.lead_id = p_lead_id
    AND mac.status = 'active'
    AND (p_code_id IS NULL OR mac.id = p_code_id)
  ORDER BY mac.created_at DESC
  LIMIT 1;

  IF v_old.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_code');
  END IF;

  SELECT sp.id, sp.name INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = v_old.plan_id AND sp.is_active = true;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  UPDATE public.merchant_access_codes
  SET
    status = 'revoked',
    updated_at = NOW(),
    notes = COALESCE(NULLIF(trim(notes), ''), '') ||
      CASE WHEN COALESCE(NULLIF(trim(notes), ''), '') = '' THEN '' ELSE ' | ' END ||
      v_reason || ' (replaced: ' || v_old.code_hint || ')'
  WHERE id = v_old.id;

  v_username := COALESCE(v_old.username, 'store' || (10000 + floor(random() * 90000)::INT)::TEXT);

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 12 THEN
      RETURN jsonb_build_object('success', false, 'error', 'generate_failed');
    END IF;

    v_record_id := gen_random_uuid();
    v_plain_code := 'BDY-' || public._access_code_random_part(4) || '-' || public._access_code_random_part(4);
    v_code_hash := public.hash_access_code(v_plain_code);
    v_auth_email := v_record_id::TEXT || '@access.slaash.internal';

    BEGIN
      INSERT INTO public.merchant_access_codes (
        id, lead_id, code_hash, code_hint, auth_email, auth_password,
        plan_id, duration_months, agreed_price, store_name, username,
        status, code_expires_at, notes, created_by
      )
      VALUES (
        v_record_id, p_lead_id, v_code_hash, right(replace(v_plain_code, '-', ''), 4),
        v_auth_email, '', v_old.plan_id, v_old.duration_months, v_old.agreed_price,
        COALESCE(v_old.store_name, v_lead.full_name, 'متجري'), v_username,
        'active', v_no_expiry, v_reason, auth.uid()
      );
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = p_lead_id AND mac.status = 'active'
        ) THEN
          RETURN jsonb_build_object('success', false, 'error', 'active_code_exists');
        END IF;
        CONTINUE;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'access_code', v_plain_code,
    'code_id', v_record_id,
    'lead_id', p_lead_id,
    'plan_id', v_old.plan_id,
    'plan_label', v_plan.name,
    'duration_months', v_old.duration_months,
    'agreed_price', v_old.agreed_price,
    'replaced_code_id', v_old.id,
    'replaced_code_hint', v_old.code_hint
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_lead_access_code(
  p_lead_id UUID,
  p_code_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lead RECORD;
  v_code RECORD;
  v_reason TEXT := COALESCE(NULLIF(trim(p_reason), ''), 'revoked by admin');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT l.id, l.converted_user_id INTO v_lead FROM public.leads l WHERE l.id = p_lead_id;
  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_not_found');
  END IF;

  SELECT mac.id, mac.status, mac.code_hint
  INTO v_code
  FROM public.merchant_access_codes mac
  WHERE mac.lead_id = p_lead_id
    AND mac.status = 'active'
    AND (p_code_id IS NULL OR mac.id = p_code_id)
  ORDER BY mac.created_at DESC
  LIMIT 1;

  IF v_code.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_code');
  END IF;

  UPDATE public.merchant_access_codes
  SET
    status = 'revoked',
    updated_at = NOW(),
    notes = COALESCE(NULLIF(trim(notes), ''), '') ||
      CASE WHEN COALESCE(NULLIF(trim(notes), ''), '') = '' THEN '' ELSE ' | ' END ||
      v_reason
  WHERE id = v_code.id;

  RETURN jsonb_build_object('success', true, 'code_id', v_code.id, 'code_hint', v_code.code_hint);
END;
$$;
