-- Subscription term starts when admin issues the first access code (not at customer login).

ALTER TABLE public.merchant_access_codes
  ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMPTZ;

COMMENT ON COLUMN public.merchant_access_codes.subscription_start_at IS
  'When the paid subscription term begins — set at first code creation, inherited on replace/reissue.';

CREATE OR REPLACE FUNCTION public._lead_subscription_term(p_lead_id UUID)
RETURNS TABLE(start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_user_id UUID;
  v_months INT;
BEGIN
  SELECT mac.subscription_start_at, mac.subscription_end_at
  INTO v_start, v_end
  FROM public.merchant_access_codes mac
  WHERE mac.lead_id = p_lead_id
    AND mac.subscription_start_at IS NOT NULL
  ORDER BY mac.created_at ASC
  LIMIT 1;

  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    start_at := v_start;
    end_at := v_end;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT mac.created_at, mac.duration_months
  INTO v_start, v_months
  FROM public.merchant_access_codes mac
  WHERE mac.lead_id = p_lead_id
  ORDER BY mac.created_at ASC
  LIMIT 1;

  IF v_start IS NOT NULL THEN
    start_at := v_start;
    end_at := v_start + (v_months || ' months')::INTERVAL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT l.converted_user_id INTO v_user_id
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF v_user_id IS NOT NULL THEN
    SELECT s.start_date, s.end_date
    INTO v_start, v_end
    FROM public.subscriptions s
    WHERE s.user_id = v_user_id
      AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
      start_at := v_start;
      end_at := v_end;
      RETURN NEXT;
    END IF;
  END IF;
END;
$$;

-- Backfill: anchor term to first code creation per lead.
WITH first_codes AS (
  SELECT DISTINCT ON (mac.lead_id)
    mac.lead_id,
    mac.created_at AS term_start,
    mac.duration_months,
    mac.subscription_end_at AS existing_end
  FROM public.merchant_access_codes mac
  ORDER BY mac.lead_id, mac.created_at ASC
)
UPDATE public.merchant_access_codes mac
SET
  subscription_start_at = fc.term_start,
  subscription_end_at = COALESCE(
    mac.subscription_end_at,
    fc.existing_end,
    fc.term_start + (fc.duration_months || ' months')::INTERVAL
  ),
  updated_at = NOW()
FROM first_codes fc
WHERE mac.lead_id = fc.lead_id
  AND mac.subscription_start_at IS NULL;

UPDATE public.subscriptions s
SET
  start_date = fc.term_start,
  end_date = COALESCE(s.end_date, fc.term_end),
  updated_at = NOW()
FROM public.leads l
JOIN (
  SELECT DISTINCT ON (mac.lead_id)
    mac.lead_id,
    mac.subscription_start_at AS term_start,
    mac.subscription_end_at AS term_end
  FROM public.merchant_access_codes mac
  WHERE mac.subscription_start_at IS NOT NULL
  ORDER BY mac.lead_id, mac.created_at ASC
) fc ON fc.lead_id = l.id
WHERE l.converted_user_id = s.user_id
  AND s.status = 'active'
  AND fc.term_start IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_list_lead_access_codes(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      mac.id,
      mac.lead_id,
      mac.code_hint,
      mac.plan_id,
      mac.duration_months,
      mac.agreed_price,
      mac.store_name,
      mac.username,
      mac.status,
      mac.code_expires_at,
      mac.subscription_start_at,
      mac.subscription_end_at,
      mac.redeemed_at,
      mac.redeemed_user_id,
      mac.created_at
    FROM public.merchant_access_codes mac
    WHERE mac.lead_id = p_lead_id
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows);
END;
$$;

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
  v_plan_cap INT;
  v_code_expires_at TIMESTAMPTZ;
  v_subscription_start_at TIMESTAMPTZ;
  v_subscription_end_at TIMESTAMPTZ;
  v_attempt INT := 0;
  v_existing RECORD;
  v_last_plan_id TEXT;
  v_last_duration INT;
  v_last_price INT;
  v_last_store_name TEXT;
  v_last_username TEXT;
  v_is_reissue BOOLEAN := false;
BEGIN
  PERFORM public.expire_stale_merchant_access_codes();

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
    IF v_lead.converted_user_id IS NOT NULL THEN
      RETURN public.admin_replace_lead_access_code(
        p_lead_id,
        v_existing.id,
        COALESCE(
          NULLIF(trim(p_notes), ''),
          'auto-replaced: active customer lost login code'
        )
      );
    END IF;

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
    v_subscription_end_at := public._anchored_subscription_end_for_lead(p_lead_id);

    IF v_subscription_end_at IS NULL OR v_subscription_end_at <= NOW() THEN
      RETURN jsonb_build_object('success', false, 'error', 'subscription_expired');
    END IF;

    SELECT t.start_at INTO v_subscription_start_at
    FROM public._lead_subscription_term(p_lead_id) t
    LIMIT 1;

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
    v_code_expires_at := v_subscription_end_at;
  ELSE
    v_plan_id := COALESCE(NULLIF(trim(p_plan_id), ''), 'annual');
  END IF;

  IF v_plan_id NOT IN ('annual', 'yearly') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  v_plan_cap := CASE WHEN v_plan_id = 'yearly' THEN 12 ELSE 6 END;

  SELECT sp.id, sp.name, sp.billing_interval_months
  INTO v_plan
  FROM public.subscription_plans sp
  WHERE sp.id = v_plan_id AND sp.is_active = true;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  IF NOT v_is_reissue THEN
    SELECT t.start_at, t.end_at
    INTO v_subscription_start_at, v_subscription_end_at
    FROM public._lead_subscription_term(p_lead_id) t
    LIMIT 1;

    IF v_subscription_start_at IS NULL THEN
      v_subscription_start_at := NOW();
      v_subscription_end_at := v_subscription_start_at + (v_plan_cap || ' months')::INTERVAL;
    END IF;

    IF v_subscription_end_at <= NOW() THEN
      RETURN jsonb_build_object('success', false, 'error', 'subscription_expired');
    END IF;

    v_code_expires_at := v_subscription_end_at;
    v_duration := LEAST(public._remaining_subscription_months(v_subscription_end_at), v_plan_cap);
  ELSE
    v_duration := LEAST(public._remaining_subscription_months(v_subscription_end_at), v_plan_cap);
  END IF;

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
        status, code_expires_at, subscription_start_at, subscription_end_at, notes, created_by
      )
      VALUES (
        v_record_id, p_lead_id, v_code_hash, right(replace(v_plain_code, '-', ''), 4),
        v_auth_email, '', v_plan_id, v_duration, v_price, v_store_name, v_username,
        'active', v_code_expires_at, v_subscription_start_at, v_subscription_end_at,
        COALESCE(NULLIF(trim(p_notes), ''), CASE WHEN v_is_reissue THEN 'reissued for active customer' ELSE 'subscription term started at code issue' END),
        auth.uid()
      );
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = p_lead_id AND mac.status = 'active'
        ) THEN
          IF v_lead.converted_user_id IS NOT NULL THEN
            RETURN public.admin_replace_lead_access_code(
              p_lead_id,
              NULL,
              COALESCE(NULLIF(trim(p_notes), ''), 'auto-replaced after conflict')
            );
          END IF;
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
    'code_expires_at', v_code_expires_at,
    'subscription_start_at', v_subscription_start_at,
    'subscription_end_at', v_subscription_end_at,
    'reissued', v_is_reissue,
    'anchored_to_subscription', true
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
  v_duration INT;
  v_plan_cap INT;
  v_code_expires_at TIMESTAMPTZ;
  v_subscription_start_at TIMESTAMPTZ;
  v_subscription_end_at TIMESTAMPTZ;
  v_attempt INT := 0;
  v_reason TEXT := COALESCE(NULLIF(trim(p_reason), ''), 'replaced by admin');
BEGIN
  PERFORM public.expire_stale_merchant_access_codes();

  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT l.id, l.full_name, l.converted_user_id INTO v_lead FROM public.leads l WHERE l.id = p_lead_id;
  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_not_found');
  END IF;

  SELECT mac.id, mac.plan_id, mac.duration_months, mac.agreed_price, mac.store_name, mac.code_hint, mac.username,
         mac.subscription_start_at, mac.subscription_end_at, mac.code_expires_at
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

  v_plan_cap := CASE WHEN v_old.plan_id = 'yearly' THEN 12 ELSE 6 END;

  SELECT t.start_at, t.end_at
  INTO v_subscription_start_at, v_subscription_end_at
  FROM public._lead_subscription_term(p_lead_id) t
  LIMIT 1;

  IF v_subscription_end_at IS NULL THEN
    v_subscription_end_at := COALESCE(
      v_old.subscription_end_at,
      public._anchored_subscription_end_for_lead(p_lead_id)
    );
  END IF;

  IF v_subscription_start_at IS NULL THEN
    v_subscription_start_at := COALESCE(v_old.subscription_start_at, NOW());
  END IF;

  IF v_subscription_end_at IS NULL OR v_subscription_end_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'subscription_expired');
  END IF;

  v_code_expires_at := v_subscription_end_at;
  v_duration := LEAST(public._remaining_subscription_months(v_subscription_end_at), v_plan_cap);

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
        status, code_expires_at, subscription_start_at, subscription_end_at, notes, created_by
      )
      VALUES (
        v_record_id, p_lead_id, v_code_hash, right(replace(v_plain_code, '-', ''), 4),
        v_auth_email, '', v_old.plan_id, v_duration, v_old.agreed_price,
        COALESCE(v_old.store_name, v_lead.full_name, 'متجري'), v_username,
        'active', v_code_expires_at, v_subscription_start_at, v_subscription_end_at,
        v_reason || ' (same subscription term)',
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

  RETURN jsonb_build_object(
    'success', true,
    'access_code', v_plain_code,
    'code_id', v_record_id,
    'lead_id', p_lead_id,
    'plan_id', v_old.plan_id,
    'plan_label', v_plan.name,
    'duration_months', v_duration,
    'agreed_price', v_old.agreed_price,
    'code_expires_at', v_code_expires_at,
    'subscription_start_at', v_subscription_start_at,
    'subscription_end_at', v_subscription_end_at,
    'replaced_code_id', v_old.id,
    'replaced_code_hint', v_old.code_hint,
    'anchored_to_subscription', true
  );
END;
$$;
