-- v31: Security hardening — storefront column projection, meta conversion claim, bundle leak fix

-- ---------------------------------------------------------------------------
-- 1) Storefront RPCs: never return full product rows (cost, owner_id leak)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_product_by_id(
  p_slug TEXT,
  p_product_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_product JSONB;
BEGIN
  IF p_slug IS NULL OR p_product_id IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.store_settings
  WHERE LOWER(store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT user_id INTO v_owner_id
    FROM public.stores
    WHERE LOWER(store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT public.storefront_product_json(p) INTO v_product
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.owner_id = v_owner_id
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL;

  RETURN v_product;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_checkout_products_by_ids(
  p_slug TEXT,
  p_product_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM public.store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT s.user_id INTO v_owner_id
    FROM public.stores s
    WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(public.storefront_product_json(p) ORDER BY p.id)
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.id = ANY(p_product_ids)
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_owner_checkout_products_by_ids(
  p_owner_id UUID,
  p_product_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(public.storefront_product_json(p) ORDER BY p.id)
    FROM public.products p
    WHERE p.owner_id = p_owner_id
      AND p.id = ANY(p_product_ids)
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ), '[]'::jsonb);
END;
$$;

-- Legacy bundle RPC — strip sensitive product columns if still deployed
CREATE OR REPLACE FUNCTION public.get_store_bundle(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_store JSONB;
  v_products JSONB;
  v_categories JSONB;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'store_name', s.store_name,
    'store_logo', s.store_logo,
    'store_slug', s.store_slug,
    'menu_background_color', s.menu_background_color,
    'menu_text_color', s.menu_text_color,
    'menu_accent_color', s.menu_accent_color,
    'store_font', s.store_font,
    'banner_images', s.banner_images,
    'primary_banner_index', s.primary_banner_index,
    'store_governorate', s.store_governorate
  ) INTO v_store
  FROM public.store_settings s
  WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.store_settings
  WHERE LOWER(store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(public.storefront_product_json(p) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_products
  FROM public.products p
  WHERE p.owner_id = v_owner_id
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', c.id, 'name', c.name, 'display_order', c.display_order)
    ORDER BY c.display_order ASC
  ), '[]'::jsonb)
  INTO v_categories
  FROM public.categories c
  WHERE c.owner_id = v_owner_id;

  RETURN jsonb_build_object(
    'store', v_store,
    'products', v_products,
    'categories', v_categories
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Meta conversion — one send per order (prevents replay / abuse)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS meta_conversion_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.verify_order_for_meta_conversion(
  p_order_id UUID,
  p_owner_id UUID,
  p_expected_total NUMERIC
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

  SELECT o.id, o.owner_id, o.total_amount, o.created_at, o.meta_conversion_sent_at
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.owner_id = p_owner_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_order.meta_conversion_sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_sent');
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

CREATE OR REPLACE FUNCTION public.mark_meta_conversion_sent(
  p_order_id UUID,
  p_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET meta_conversion_sent_at = NOW()
  WHERE id = p_order_id
    AND owner_id = p_owner_id
    AND meta_conversion_sent_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_meta_conversion_sent(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_meta_conversion_sent(UUID, UUID) TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (31, 'security: storefront column projection, meta conversion claim, bundle hardening')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
