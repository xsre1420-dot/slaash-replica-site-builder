-- v57: Storefront bundle payload optimization — grid JSON, slim store shell, fix v56 full-json regression
-- Target: ≥70% payload reduction vs v56 full storefront_product_json bundle

-- ---------------------------------------------------------------------------
-- 1) Compact variant array (strip unused keys from JSONB variants)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_compact_variants(p_variants JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' OR jsonb_array_length(p_variants) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'size', NULLIF(trim(elem->>'size'), ''),
            'color', NULLIF(trim(elem->>'color'), ''),
            'quantity', (elem->>'quantity')::int
          )
        )
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(p_variants) AS elem
    WHERE COALESCE((elem->>'quantity')::int, 0) >= 0
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Grid product JSON — catalog/card pages only (detail RPC keeps full JSON)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_product_grid_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_has_discount BOOLEAN;
BEGIN
  v_has_discount := COALESCE(p.discount_type, 'none') <> 'none'
    AND p.discount_value IS NOT NULL
    AND COALESCE(p.discount_value, 0) > 0;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'description', left(COALESCE(p.description, ''), 80),
      'category', NULLIF(trim(p.category), ''),
      'price', p.price,
      'image_url', p.image_url,
      'stock_quantity', p.stock_quantity,
      'sizes', CASE WHEN p.sizes IS NULL OR cardinality(p.sizes) = 0 THEN NULL ELSE to_jsonb(p.sizes) END,
      'colors', CASE WHEN p.colors IS NULL OR p.colors = '[]'::jsonb THEN NULL ELSE p.colors END,
      'variants', public.storefront_compact_variants(p.variants),
      'discount_type', CASE WHEN v_has_discount THEN p.discount_type ELSE NULL END,
      'discount_value', CASE WHEN v_has_discount THEN p.discount_value ELSE NULL END,
      'discount_start_date', CASE WHEN v_has_discount THEN p.discount_start_date ELSE NULL END,
      'discount_end_date', CASE WHEN v_has_discount THEN p.discount_end_date ELSE NULL END,
      'original_price', CASE WHEN v_has_discount THEN COALESCE(p.original_price, p.price) ELSE NULL END,
      'created_at', p.created_at
    )
  );
END;
$$;

-- Keep card JSON as alias to grid (backward compatible name from v48)
CREATE OR REPLACE FUNCTION public.storefront_product_card_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN public.storefront_product_grid_json(p);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Slim store shell — omit long policy blobs from hot bundle path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storefront_store_shell_json(
  p_owner_id UUID,
  p_cache_version BIGINT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_store JSONB;
BEGIN
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
    'payment_methods', ss.payment_methods,
    'cache_version', COALESCE(p_cache_version, ss.storefront_cache_version, 1)
  )
  INTO v_store
  FROM public.store_settings ss
  WHERE ss.owner_id = p_owner_id
  LIMIT 1;

  IF v_store IS NOT NULL THEN
    RETURN v_store;
  END IF;

  SELECT jsonb_build_object(
    'owner_id', st.user_id,
    'store_name', st.store_name,
    'store_slug', st.store_slug,
    'cache_version', COALESCE(p_cache_version, 1)
  )
  INTO v_store
  FROM public.stores st
  WHERE st.user_id = p_owner_id
  LIMIT 1;

  RETURN v_store;
END;
$$;

-- Lazy policy fetch for footer / product detail (not in hot bundle)
CREATE OR REPLACE FUNCTION public.get_store_policies(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'return_policy', ss.return_policy,
      'privacy_policy', ss.privacy_policy
    )
    FROM public.store_settings ss
    WHERE ss.owner_id = v_owner_id
    LIMIT 1
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) get_store_meta — shell by default; optional policies via p_include_policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_meta(
  p_slug TEXT,
  p_include_policies BOOLEAN DEFAULT false
)
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
  v_policies JSONB;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(ss.storefront_cache_version, 1)
  INTO v_cache_version
  FROM public.store_settings ss
  WHERE ss.owner_id = v_owner_id
  LIMIT 1;

  v_store := public.storefront_store_shell_json(v_owner_id, v_cache_version);

  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE(p_include_policies, false) THEN
    v_policies := public.get_store_policies(p_slug);
    IF v_policies IS NOT NULL THEN
      v_store := v_store || v_policies;
    END IF;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', c.id, 'name', c.name, 'display_order', c.display_order)
      ORDER BY c.display_order ASC
    ),
    '[]'::jsonb
  )
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

-- ---------------------------------------------------------------------------
-- 5) Bundle + paginated products — grid JSON (fixes v56 full-json regression)
-- ---------------------------------------------------------------------------
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

  v_meta := public.get_store_meta(p_slug, false);
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
      public.storefront_product_grid_json(p) AS pj,
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

CREATE OR REPLACE FUNCTION public.get_store_products_page(
  p_slug TEXT,
  p_limit INT DEFAULT 24,
  p_cursor TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);

  IF p_cursor IS NOT NULL AND trim(p_cursor) <> '' AND position('|' IN p_cursor) > 0 THEN
    v_cursor_ts := split_part(p_cursor, '|', 1)::timestamptz;
    v_cursor_id := split_part(p_cursor, '|', 2)::uuid;
  END IF;

  WITH ranked AS (
    SELECT
      p.created_at,
      p.id,
      public.storefront_product_grid_json(p) AS pj,
      ROW_NUMBER() OVER (ORDER BY p.created_at DESC, p.id DESC) AS rn
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.archived_at IS NULL
      AND COALESCE(p.is_active, true) = true
      AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
      AND (
        p_search IS NULL OR trim(p_search) = ''
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
    'products', COALESCE(v_products, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_compact_variants(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_product_grid_json(public.products) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_store_shell_json(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_policies(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.storefront_product_card_json(public.products) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_policies(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_meta(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_page_bundle(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_products_page(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (57, 'storefront_payload: grid JSON, slim store shell, fix v56 full-json regression')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
