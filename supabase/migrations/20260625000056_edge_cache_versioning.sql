-- v56: Edge cache versioning — safe CDN/worker invalidation without full purge

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS storefront_cache_version BIGINT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.store_settings.storefront_cache_version IS
  'Monotonic version for edge/client cache keys; bumped on catalog/branding changes';

CREATE INDEX IF NOT EXISTS idx_store_settings_slug_cache_version
  ON public.store_settings (store_slug, storefront_cache_version)
  WHERE store_slug IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Bump helper (owner-scoped)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_storefront_cache_version(p_owner_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version BIGINT;
BEGIN
  IF p_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.store_settings
  SET storefront_cache_version = storefront_cache_version + 1,
      updated_at = NOW()
  WHERE owner_id = p_owner_id
  RETURNING storefront_cache_version INTO v_version;

  IF v_version IS NULL THEN
    INSERT INTO public.store_settings (owner_id, store_name, storefront_cache_version)
    VALUES (p_owner_id, 'Store', 1)
    ON CONFLICT (owner_id) DO UPDATE
      SET storefront_cache_version = public.store_settings.storefront_cache_version + 1,
          updated_at = NOW()
    RETURNING storefront_cache_version INTO v_version;
  END IF;

  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_storefront_cache_version(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_storefront_cache_version(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Lightweight version lookup for edge workers (anon-safe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_storefront_cache_version(p_slug TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_version BIGINT;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ss.storefront_cache_version INTO v_version
  FROM public.store_settings ss
  WHERE ss.owner_id = v_owner_id
  LIMIT 1;

  RETURN COALESCE(v_version, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_cache_version(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_cache_version(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers — catalog/branding changes only (stock-only updates skip bump)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_bump_storefront_cache_on_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  v_owner_id := COALESCE(NEW.owner_id, OLD.owner_id);

  IF TG_OP IN ('INSERT', 'DELETE') THEN
    PERFORM public.bump_storefront_cache_version(v_owner_id);
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_old := to_jsonb(OLD) - 'stock_quantity' - 'variants' - 'updated_at'
    - 'low_stock_threshold' - 'min_stock_level';
  v_new := to_jsonb(NEW) - 'stock_quantity' - 'variants' - 'updated_at'
    - 'low_stock_threshold' - 'min_stock_level';

  IF v_old IS DISTINCT FROM v_new THEN
    PERFORM public.bump_storefront_cache_version(v_owner_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_storefront_cache ON public.products;
CREATE TRIGGER trg_products_storefront_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_storefront_cache_on_product();

CREATE OR REPLACE FUNCTION public.trg_bump_storefront_cache_on_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.bump_storefront_cache_version(COALESCE(NEW.owner_id, OLD.owner_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_storefront_cache ON public.categories;
CREATE TRIGGER trg_categories_storefront_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_storefront_cache_on_category();

CREATE OR REPLACE FUNCTION public.trg_bump_storefront_cache_on_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.storefront_cache_version := COALESCE(NEW.storefront_cache_version, 1);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.storefront_cache_version IS DISTINCT FROM NEW.storefront_cache_version THEN
      RETURN NEW;
    END IF;
    IF to_jsonb(OLD) - 'updated_at' - 'storefront_cache_version'
       IS NOT DISTINCT FROM to_jsonb(NEW) - 'updated_at' - 'storefront_cache_version' THEN
      RETURN NEW;
    END IF;
  END IF;

  NEW.storefront_cache_version := COALESCE(OLD.storefront_cache_version, NEW.storefront_cache_version, 1) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_settings_storefront_cache ON public.store_settings;
CREATE TRIGGER trg_store_settings_storefront_cache
  BEFORE INSERT OR UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_storefront_cache_on_settings();

-- ---------------------------------------------------------------------------
-- Include cache_version in storefront RPC responses
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_meta(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_store JSONB;
  v_categories JSONB;
  v_cache_version BIGINT;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'owner_id', ss.owner_id,
    'store_name', ss.store_name,
    'store_logo', ss.store_logo,
    'store_slug', ss.store_slug,
    'menu_background_color', ss.menu_background_color,
    'menu_text_color', ss.menu_text_color,
    'menu_accent_color', ss.menu_accent_color,
    'store_font', ss.store_font,
    'banner_images', ss.banner_images,
    'primary_banner_index', ss.primary_banner_index,
    'delivery_prices', ss.delivery_prices,
    'whatsapp_number', ss.whatsapp_number,
    'facebook_url', ss.facebook_url,
    'instagram_url', ss.instagram_url,
    'return_policy', ss.return_policy,
    'privacy_policy', ss.privacy_policy,
    'payment_methods', ss.payment_methods,
    'cache_version', ss.storefront_cache_version
  ), ss.storefront_cache_version
  INTO v_store, v_cache_version
  FROM public.store_settings ss
  WHERE ss.owner_id = v_owner_id
  LIMIT 1;

  IF v_store IS NULL THEN
    SELECT jsonb_build_object(
      'owner_id', st.user_id,
      'store_name', st.store_name,
      'store_logo', NULL,
      'store_slug', st.store_slug,
      'menu_background_color', '#ffffff',
      'menu_text_color', '#333333',
      'menu_accent_color', '#6366f1',
      'store_font', 'Tajawal',
      'banner_images', '[]'::jsonb,
      'primary_banner_index', 0,
      'delivery_prices', '[]'::jsonb,
      'whatsapp_number', NULL,
      'facebook_url', NULL,
      'instagram_url', NULL,
      'return_policy', NULL,
      'privacy_policy', NULL,
      'payment_methods', '["cash_on_delivery"]'::jsonb,
      'cache_version', 1
    ) INTO v_store
    FROM public.stores st
    WHERE st.user_id = v_owner_id
    LIMIT 1;
    v_cache_version := 1;
  END IF;

  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', c.id, 'name', c.name, 'display_order', c.display_order)
    ORDER BY c.display_order ASC
  ), '[]'::jsonb)
  INTO v_categories
  FROM public.categories c
  WHERE c.owner_id = v_owner_id;

  RETURN jsonb_build_object(
    'store', v_store,
    'categories', v_categories,
    'cache_version', COALESCE(v_cache_version, 1)
  );
END;
$$;

-- Patch bundle store object with cache_version (reuse get_store_meta store shape)
CREATE OR REPLACE FUNCTION public.get_storefront_page_bundle(
  p_slug TEXT,
  p_limit INT DEFAULT 24,
  p_cursor TEXT DEFAULT '',
  p_category TEXT DEFAULT '',
  p_search TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta JSONB;
  v_owner_id UUID;
  v_limit INT;
  v_cursor_ts TIMESTAMPTZ;
  v_cursor_id UUID;
  v_products JSONB;
  v_next_cursor TEXT;
  v_has_more BOOLEAN;
  v_last_created TIMESTAMPTZ;
  v_last_id UUID;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  v_meta := public.get_store_meta(p_slug);
  IF v_meta IS NULL OR v_meta->'store' IS NULL THEN
    RETURN NULL;
  END IF;

  v_owner_id := (v_meta->'store'->>'owner_id')::uuid;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);

  IF NULLIF(trim(p_cursor), '') IS NOT NULL AND position('|' IN trim(p_cursor)) > 0 THEN
    v_cursor_ts := split_part(trim(p_cursor), '|', 1)::timestamptz;
    v_cursor_id := split_part(trim(p_cursor), '|', 2)::uuid;
  END IF;

  WITH ranked AS (
    SELECT
      p.created_at,
      p.id,
      public.storefront_product_json(p) AS pj,
      ROW_NUMBER() OVER (ORDER BY p.created_at DESC, p.id DESC) AS rn
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.archived_at IS NULL
      AND COALESCE(p.is_active, true) = true
      AND (NULLIF(trim(p_category), '') IS NULL OR p.category = trim(p_category))
      AND (
        NULLIF(trim(p_search), '') IS NULL
        OR p.name ILIKE '%' || trim(p_search) || '%'
        OR p.description ILIKE '%' || trim(p_search) || '%'
      )
      AND (
        v_cursor_ts IS NULL
        OR (p.created_at, p.id) < (v_cursor_ts, v_cursor_id)
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit + 1
  )
  SELECT
    COALESCE((SELECT jsonb_agg(r.pj ORDER BY r.created_at DESC, r.id DESC) FROM ranked r WHERE r.rn <= v_limit), '[]'::jsonb),
    (SELECT COUNT(*) FROM ranked) > v_limit,
    (SELECT r.created_at FROM ranked r WHERE r.rn = v_limit),
    (SELECT r.id FROM ranked r WHERE r.rn = v_limit)
  INTO v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  ELSE
    v_next_cursor := NULL;
    v_has_more := false;
  END IF;

  RETURN jsonb_build_object(
    'store', v_meta->'store',
    'categories', v_meta->'categories',
    'products', COALESCE(v_products, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false),
    'cache_version', COALESCE((v_meta->>'cache_version')::bigint, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_cache_version(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_cache_version(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_meta(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_page_bundle(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (56, 'edge_cache_versioning: storefront_cache_version + bump triggers + RPC version fields')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
