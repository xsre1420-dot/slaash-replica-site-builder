-- Marketing tracking: public-safe config RPC + order attribution column

-- ---------------------------------------------------------------------------
-- M-01: Public marketing config by store slug (anon-safe, no secrets)
-- ---------------------------------------------------------------------------
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

  SELECT meta_pixel_id, google_analytics_id, marketing_enabled
  INTO v_settings
  FROM marketing_settings
  WHERE owner_id = v_owner;

  IF NOT FOUND OR COALESCE(v_settings.marketing_enabled, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'owner_id', v_owner,
      'marketing_enabled', false,
      'meta_pixel_id', null,
      'google_analytics_id', null
    );
  END IF;

  RETURN jsonb_build_object(
    'owner_id', v_owner,
    'marketing_enabled', true,
    'meta_pixel_id', NULLIF(trim(v_settings.meta_pixel_id), ''),
    'google_analytics_id', NULLIF(trim(v_settings.google_analytics_id), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_marketing_public(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_marketing_public(TEXT) TO anon, authenticated;

-- Authenticated merchant fallback (preview paths without slug)
CREATE OR REPLACE FUNCTION public.get_store_marketing_for_owner(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  SELECT meta_pixel_id, google_analytics_id, marketing_enabled
  INTO v_settings
  FROM marketing_settings
  WHERE owner_id = p_owner_id;

  IF NOT FOUND OR COALESCE(v_settings.marketing_enabled, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'owner_id', p_owner_id,
      'marketing_enabled', false,
      'meta_pixel_id', null,
      'google_analytics_id', null
    );
  END IF;

  RETURN jsonb_build_object(
    'owner_id', p_owner_id,
    'marketing_enabled', true,
    'meta_pixel_id', NULLIF(trim(v_settings.meta_pixel_id), ''),
    'google_analytics_id', NULLIF(trim(v_settings.google_analytics_id), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_marketing_for_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_marketing_for_owner(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- M-08: Persist campaign attribution on orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS marketing_attribution JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_marketing_attribution
  ON public.orders USING gin (marketing_attribution)
  WHERE marketing_attribution IS NOT NULL;

-- Attach attribution post-checkout (anon-safe via slug-bound order ownership)
CREATE OR REPLACE FUNCTION public.attach_order_marketing_attribution(
  p_order_id UUID,
  p_store_slug TEXT,
  p_attribution JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_order_owner UUID;
BEGIN
  IF p_order_id IS NULL OR p_attribution IS NULL OR p_attribution = 'null'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_payload');
  END IF;

  IF p_store_slug IS NULL OR trim(p_store_slug) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'slug_required');
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM store_settings ss
  WHERE lower(trim(ss.store_slug)) = lower(trim(p_store_slug))
  LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT s.user_id INTO v_owner
    FROM stores s
    WHERE lower(trim(s.store_slug)) = lower(trim(p_store_slug))
    LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  SELECT owner_id INTO v_order_owner FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order_owner <> v_owner THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  UPDATE orders
  SET marketing_attribution = p_attribution, updated_at = NOW()
  WHERE id = p_order_id AND owner_id = v_owner;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_order_marketing_attribution(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_order_marketing_attribution(UUID, TEXT, JSONB) TO anon, authenticated;
