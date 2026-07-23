-- Enterprise Meta Pixel + Conversions API settings (multi-tenant isolated per owner_id)

ALTER TABLE public.marketing_settings
  ADD COLUMN IF NOT EXISTS meta_test_event_code TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_browser_events_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_debug_mode BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_dataset_id TEXT,
  ADD COLUMN IF NOT EXISTS facebook_access_token_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.marketing_settings.meta_test_event_code IS
  'Meta Events Manager test code — used server-side only; never exposed to storefront';
COMMENT ON COLUMN public.marketing_settings.facebook_access_token IS
  'Meta Conversions API access token — server-side only';

-- Merchant-safe settings (includes token configured flag, never the token value)
CREATE OR REPLACE FUNCTION public.get_merchant_marketing_settings(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.marketing_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_row FROM public.marketing_settings WHERE owner_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'meta_pixel_id', null,
      'google_analytics_id', null,
      'marketing_enabled', false,
      'email_marketing_enabled', false,
      'sms_marketing_enabled', false,
      'meta_capi_enabled', true,
      'meta_browser_events_enabled', true,
      'meta_debug_mode', false,
      'meta_test_event_code', null,
      'meta_dataset_id', null,
      'facebook_access_token_configured', false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'meta_pixel_id', NULLIF(trim(v_row.meta_pixel_id), ''),
    'google_analytics_id', NULLIF(trim(v_row.google_analytics_id), ''),
    'marketing_enabled', COALESCE(v_row.marketing_enabled, false),
    'email_marketing_enabled', COALESCE(v_row.email_marketing_enabled, false),
    'sms_marketing_enabled', COALESCE(v_row.sms_marketing_enabled, false),
    'meta_capi_enabled', COALESCE(v_row.meta_capi_enabled, true),
    'meta_browser_events_enabled', COALESCE(v_row.meta_browser_events_enabled, true),
    'meta_debug_mode', COALESCE(v_row.meta_debug_mode, false),
    'meta_test_event_code', NULLIF(trim(v_row.meta_test_event_code), ''),
    'meta_dataset_id', NULLIF(trim(v_row.meta_dataset_id), ''),
    'facebook_access_token_configured', COALESCE(length(trim(v_row.facebook_access_token)) > 0, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_marketing_settings(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_marketing_settings(UUID) TO authenticated;

-- Public storefront config (no secrets, no test codes)
CREATE OR REPLACE FUNCTION public.get_store_marketing_public(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_settings RECORD;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM store_settings ss
  WHERE lower(trim(ss.store_slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT s.user_id INTO v_owner
    FROM stores s
    WHERE lower(trim(s.store_slug)) = lower(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    meta_pixel_id,
    google_analytics_id,
    marketing_enabled,
    meta_browser_events_enabled,
    meta_debug_mode
  INTO v_settings
  FROM marketing_settings
  WHERE owner_id = v_owner;

  IF NOT FOUND OR COALESCE(v_settings.marketing_enabled, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'owner_id', v_owner,
      'marketing_enabled', false,
      'meta_pixel_id', null,
      'google_analytics_id', null,
      'meta_browser_events_enabled', false,
      'meta_debug_mode', false
    );
  END IF;

  RETURN jsonb_build_object(
    'owner_id', v_owner,
    'marketing_enabled', true,
    'meta_pixel_id', NULLIF(trim(v_settings.meta_pixel_id), ''),
    'google_analytics_id', NULLIF(trim(v_settings.google_analytics_id), ''),
    'meta_browser_events_enabled', COALESCE(v_settings.meta_browser_events_enabled, true),
    'meta_debug_mode', COALESCE(v_settings.meta_debug_mode, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_marketing_for_owner(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_settings RECORD;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN NULL;
  END IF;

  SELECT
    meta_pixel_id,
    google_analytics_id,
    marketing_enabled,
    meta_browser_events_enabled,
    meta_debug_mode
  INTO v_settings
  FROM marketing_settings
  WHERE owner_id = p_owner_id;

  IF NOT FOUND OR COALESCE(v_settings.marketing_enabled, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'owner_id', p_owner_id,
      'marketing_enabled', false,
      'meta_pixel_id', null,
      'google_analytics_id', null,
      'meta_browser_events_enabled', false,
      'meta_debug_mode', false
    );
  END IF;

  RETURN jsonb_build_object(
    'owner_id', p_owner_id,
    'marketing_enabled', true,
    'meta_pixel_id', NULLIF(trim(v_settings.meta_pixel_id), ''),
    'google_analytics_id', NULLIF(trim(v_settings.google_analytics_id), ''),
    'meta_browser_events_enabled', COALESCE(v_settings.meta_browser_events_enabled, true),
    'meta_debug_mode', COALESCE(v_settings.meta_debug_mode, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_merchant_marketing_settings(
  p_owner_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing public.marketing_settings%ROWTYPE;
  v_merged JSONB;
  v_new_token TEXT;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_existing
  FROM public.marketing_settings
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.marketing_settings (owner_id)
    VALUES (p_owner_id)
    RETURNING * INTO v_existing;
  END IF;

  v_merged := to_jsonb(v_existing) || (p_patch - 'owner_id' - 'created_at' - 'updated_at');

  IF to_jsonb(v_existing) - 'updated_at' IS NOT DISTINCT FROM v_merged - 'updated_at' THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  v_new_token := NULLIF(trim(v_merged->>'facebook_access_token'), '');

  UPDATE public.marketing_settings ms
  SET
    marketing_enabled = COALESCE((v_merged->>'marketing_enabled')::boolean, ms.marketing_enabled),
    email_marketing_enabled = COALESCE((v_merged->>'email_marketing_enabled')::boolean, ms.email_marketing_enabled),
    sms_marketing_enabled = COALESCE((v_merged->>'sms_marketing_enabled')::boolean, ms.sms_marketing_enabled),
    meta_pixel_id = COALESCE(NULLIF(trim(v_merged->>'meta_pixel_id'), ''), ms.meta_pixel_id),
    google_analytics_id = COALESCE(NULLIF(trim(v_merged->>'google_analytics_id'), ''), ms.google_analytics_id),
    facebook_access_token = CASE
      WHEN v_merged ? 'facebook_access_token' AND v_new_token IS NOT NULL THEN v_new_token
      ELSE ms.facebook_access_token
    END,
    facebook_access_token_set_at = CASE
      WHEN v_merged ? 'facebook_access_token' AND v_new_token IS NOT NULL THEN NOW()
      ELSE ms.facebook_access_token_set_at
    END,
    meta_test_event_code = COALESCE(NULLIF(trim(v_merged->>'meta_test_event_code'), ''), ms.meta_test_event_code),
    meta_capi_enabled = COALESCE((v_merged->>'meta_capi_enabled')::boolean, ms.meta_capi_enabled),
    meta_browser_events_enabled = COALESCE((v_merged->>'meta_browser_events_enabled')::boolean, ms.meta_browser_events_enabled),
    meta_debug_mode = COALESCE((v_merged->>'meta_debug_mode')::boolean, ms.meta_debug_mode),
    meta_dataset_id = COALESCE(NULLIF(trim(v_merged->>'meta_dataset_id'), ''), ms.meta_dataset_id),
    updated_at = NOW()
  WHERE owner_id = p_owner_id;

  RETURN jsonb_build_object('success', true, 'noop', false);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'upsert_failed');
END;
$$;
