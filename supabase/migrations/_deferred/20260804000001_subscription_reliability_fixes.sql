-- Subscription reliability: lead idempotency, access-code duration constraint, hash alignment

-- ---------------------------------------------------------------------------
-- 1) Widen duration_months CHECK — remaining months can be 1–12, not only 6/12
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchant_access_codes
  DROP CONSTRAINT IF EXISTS merchant_access_codes_duration_months_check;

ALTER TABLE public.merchant_access_codes
  ADD CONSTRAINT merchant_access_codes_duration_months_check
  CHECK (duration_months >= 1 AND duration_months <= 12);

-- ---------------------------------------------------------------------------
-- 2) Align SQL hash with TS/edge: extract BDY+8 before hashing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_access_code_for_hash(p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_norm TEXT;
  v_match TEXT;
BEGIN
  v_norm := upper(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g'));

  SELECT (regexp_match(v_norm, 'BDY[A-HJ-NP-Z2-9]{8}'))[1] INTO v_match;
  IF v_match IS NOT NULL THEN
    RETURN v_match;
  END IF;

  IF v_norm LIKE 'BDY%' AND length(v_norm) >= 11 THEN
    RETURN left(v_norm, 11);
  END IF;

  RETURN v_norm;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_access_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(digest(public.resolve_access_code_for_hash(p_code), 'sha256'), 'hex');
$$;

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
    v_hash := encode(digest(public.normalize_access_code(trim(p_code)), 'sha256'), 'hex');
    SELECT mac.* INTO v_code
    FROM public.merchant_access_codes mac
    WHERE mac.code_hash = v_hash
    LIMIT 1;
  END IF;

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

-- ---------------------------------------------------------------------------
-- 3) Lead submission idempotency — one open request per WhatsApp number
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_access_lead(
  p_full_name TEXT,
  p_whatsapp_number TEXT,
  p_source TEXT DEFAULT 'website',
  p_selected_plan_id TEXT DEFAULT NULL,
  p_governorate TEXT DEFAULT NULL,
  p_instagram_url TEXT DEFAULT NULL,
  p_expected_monthly_orders TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
  v_existing_id UUID;
  v_name TEXT;
  v_phone TEXT;
  v_plan_id TEXT;
  v_plan_name TEXT;
  v_governorate TEXT;
  v_instagram TEXT;
  v_orders TEXT;
  v_ip TEXT;
BEGIN
  v_name := trim(COALESCE(p_full_name, ''));
  v_phone := public.normalize_whatsapp_number(p_whatsapp_number);
  v_plan_id := NULLIF(trim(COALESCE(p_selected_plan_id, '')), '');
  v_governorate := NULLIF(trim(COALESCE(p_governorate, '')), '');
  v_instagram := NULLIF(trim(COALESCE(p_instagram_url, '')), '');
  v_orders := NULLIF(trim(COALESCE(p_expected_monthly_orders, '')), '');

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    '0.0.0.0'
  );

  IF v_phone IS NOT NULL AND NOT public.check_rpc_rate_limit('lead:' || v_ip || ':' || v_phone, 10, 3600) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  IF length(v_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_name');
  END IF;
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_whatsapp');
  END IF;
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;
  IF v_governorate IS NULL OR length(v_governorate) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_governorate');
  END IF;
  IF v_orders IS NULL OR length(v_orders) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_monthly_orders');
  END IF;

  SELECT sp.name INTO v_plan_name
  FROM public.subscription_plans sp
  WHERE sp.id = v_plan_id AND sp.is_active = true;

  IF v_plan_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  -- Reuse existing open lead for the same WhatsApp (prevents duplicate admin notifications)
  SELECT l.id INTO v_existing_id
  FROM public.leads l
  WHERE l.whatsapp_number = v_phone
    AND l.status IN ('new', 'contacted', 'interested')
    AND l.converted_user_id IS NULL
  ORDER BY l.created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.leads
    SET
      full_name = v_name,
      selected_plan_id = v_plan_id,
      selected_plan_name = v_plan_name,
      governorate = v_governorate,
      instagram_url = v_instagram,
      expected_monthly_orders = v_orders,
      admin_read_at = NULL,
      updated_at = NOW()
    WHERE id = v_existing_id;

    RETURN jsonb_build_object(
      'success', true,
      'lead_id', v_existing_id,
      'existing', true
    );
  END IF;

  INSERT INTO public.leads (
    full_name,
    whatsapp_number,
    source,
    status,
    selected_plan_id,
    selected_plan_name,
    governorate,
    instagram_url,
    expected_monthly_orders
  )
  VALUES (
    v_name,
    v_phone,
    COALESCE(NULLIF(trim(p_source), ''), 'website'),
    'new',
    v_plan_id,
    v_plan_name,
    v_governorate,
    v_instagram,
    v_orders
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id, 'existing', false);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) has_pending_code: only for leads not yet converted (admin_list_leads)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_leads(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_filter TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
  v_filter TEXT := NULLIF(trim(COALESCE(p_filter, '')), '');
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW() AT TIME ZONE 'Asia/Baghdad');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.leads l
  WHERE (p_status IS NULL OR trim(p_status) = '' OR l.status = p_status)
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR l.full_name ILIKE '%' || trim(p_search) || '%'
      OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
      OR COALESCE(l.selected_plan_name, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(l.selected_plan_id, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(l.governorate, '') ILIKE '%' || trim(p_search) || '%'
    )
    AND (
      v_filter IS NULL
      OR (v_filter = 'unread' AND l.status = 'new' AND l.admin_read_at IS NULL)
      OR (
        v_filter = 'needs_code'
        AND l.converted_user_id IS NULL
        AND l.status IN ('contacted', 'interested')
        AND NOT EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = l.id AND mac.status = 'active'
        )
      )
      OR (
        v_filter = 'pending_activation'
        AND l.converted_user_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = l.id AND mac.status = 'active'
        )
      )
      OR (
        v_filter = 'pipeline'
        AND l.converted_user_id IS NULL
        AND l.status NOT IN ('rejected', 'customer')
      )
      OR (v_filter = 'customers' AND (l.status = 'customer' OR l.converted_user_id IS NOT NULL))
      OR (v_filter = 'today' AND l.created_at >= v_today_start)
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      l.id,
      l.full_name,
      l.whatsapp_number,
      l.status,
      l.source,
      l.notes,
      l.selected_plan_id,
      l.selected_plan_name,
      l.governorate,
      l.instagram_url,
      l.expected_monthly_orders,
      l.admin_read_at,
      l.converted_user_id,
      l.converted_at,
      l.created_at,
      l.updated_at,
      (l.status = 'new' AND l.admin_read_at IS NULL) AS is_unread,
      (
        l.converted_user_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = l.id AND mac.status = 'active'
        )
      ) AS has_pending_code
    FROM public.leads l
    WHERE (p_status IS NULL OR trim(p_status) = '' OR l.status = p_status)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR l.full_name ILIKE '%' || trim(p_search) || '%'
        OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
        OR COALESCE(l.selected_plan_name, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(l.selected_plan_id, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(l.governorate, '') ILIKE '%' || trim(p_search) || '%'
      )
      AND (
        v_filter IS NULL
        OR (v_filter = 'unread' AND l.status = 'new' AND l.admin_read_at IS NULL)
        OR (
          v_filter = 'needs_code'
          AND l.converted_user_id IS NULL
          AND l.status IN ('contacted', 'interested')
          AND NOT EXISTS (
            SELECT 1 FROM public.merchant_access_codes mac
            WHERE mac.lead_id = l.id AND mac.status = 'active'
          )
        )
        OR (
          v_filter = 'pending_activation'
          AND l.converted_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.merchant_access_codes mac
            WHERE mac.lead_id = l.id AND mac.status = 'active'
          )
        )
        OR (
          v_filter = 'pipeline'
          AND l.converted_user_id IS NULL
          AND l.status NOT IN ('rejected', 'customer')
        )
        OR (v_filter = 'customers' AND (l.status = 'customer' OR l.converted_user_id IS NOT NULL))
        OR (v_filter = 'today' AND l.created_at >= v_today_start)
      )
    ORDER BY
      CASE WHEN l.status = 'new' AND l.admin_read_at IS NULL THEN 0 ELSE 1 END,
      CASE
        WHEN l.converted_user_id IS NOT NULL THEN 3
        WHEN EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = l.id AND mac.status = 'active'
        ) THEN 2
        ELSE 1
      END,
      l.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows, 'total', v_total);
END;
$$;

-- Index to speed up idempotent lead lookup
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_open
  ON public.leads (whatsapp_number, created_at DESC)
  WHERE status IN ('new', 'contacted', 'interested') AND converted_user_id IS NULL;

-- ---------------------------------------------------------------------------
-- 5) Admin verify: dual-hash lookup (same as preview + edge)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_verify_lead_access_code(
  p_lead_id UUID,
  p_plain_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_code RECORD;
  v_plan RECORD;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF COALESCE(NULLIF(trim(p_plain_code), ''), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  v_hash := public.hash_access_code(trim(p_plain_code));

  SELECT mac.id, mac.plan_id, mac.duration_months, mac.agreed_price, mac.store_name,
         mac.code_hint, mac.status, mac.created_at
  INTO v_code
  FROM public.merchant_access_codes mac
  WHERE mac.lead_id = p_lead_id AND mac.code_hash = v_hash
  ORDER BY mac.created_at DESC
  LIMIT 1;

  IF v_code.id IS NULL THEN
    v_hash := encode(digest(public.normalize_access_code(trim(p_plain_code)), 'sha256'), 'hex');
    SELECT mac.id, mac.plan_id, mac.duration_months, mac.agreed_price, mac.store_name,
           mac.code_hint, mac.status, mac.created_at
    INTO v_code
    FROM public.merchant_access_codes mac
    WHERE mac.lead_id = p_lead_id AND mac.code_hash = v_hash
    ORDER BY mac.created_at DESC
    LIMIT 1;
  END IF;

  IF v_code.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_code.status <> 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE v_code.status
        WHEN 'revoked' THEN 'code_revoked'
        WHEN 'redeemed' THEN 'lead_already_converted'
        ELSE 'code_expired'
      END
    );
  END IF;

  SELECT sp.name INTO v_plan FROM public.subscription_plans sp WHERE sp.id = v_code.plan_id;

  RETURN jsonb_build_object(
    'success', true,
    'code_id', v_code.id,
    'code_hint', v_code.code_hint,
    'plan_id', v_code.plan_id,
    'plan_label', COALESCE(v_plan.name, v_code.plan_id),
    'duration_months', v_code.duration_months,
    'agreed_price', v_code.agreed_price,
    'store_name', v_code.store_name,
    'created_at', v_code.created_at
  );
END;
$$;
