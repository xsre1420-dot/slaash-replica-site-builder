-- v32: Scale 500→1000+ concurrent storefront users
-- Slug resolver, single-pass bundle RPC, visit trigger O(1), index-aligned lookups

-- ---------------------------------------------------------------------------
-- 1) Slug → owner resolver (one indexed lookup per RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._resolve_store_owner_by_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT ss.owner_id
      FROM public.store_settings ss
      WHERE LOWER(ss.store_slug) = lower(trim(p_slug))
      LIMIT 1
    ),
    (
      SELECT s.user_id
      FROM public.stores s
      WHERE LOWER(s.store_slug) = lower(trim(p_slug))
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public._resolve_store_owner_by_slug(TEXT) FROM PUBLIC;

-- Align indexes with LOWER(store_slug) = lower(trim(p_slug)) predicate
CREATE INDEX IF NOT EXISTS idx_stores_slug_lower_trim
  ON public.stores (LOWER(store_slug))
  WHERE store_slug IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Visit rate limit — stop at 10 rows instead of full COUNT(*)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_store_visit(
  p_owner_id UUID,
  p_visitor_ip TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.store_visits sv
    WHERE sv.owner_id = p_owner_id
      AND sv.visitor_ip = p_visitor_ip
      AND sv.created_at > NOW() - INTERVAL '1 hour'
    OFFSET 9
    LIMIT 1
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) O(1) unique-visitor daily rollup (replaces store_visits scan in trigger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_visitor_daily_keys (
  owner_id UUID NOT NULL,
  stat_date DATE NOT NULL,
  visitor_ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, stat_date, visitor_ip)
);

CREATE INDEX IF NOT EXISTS idx_store_visitor_daily_keys_date
  ON public.store_visitor_daily_keys (stat_date);

ALTER TABLE public.store_visitor_daily_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_visitor_daily_keys_deny ON public.store_visitor_daily_keys;
CREATE POLICY store_visitor_daily_keys_deny ON public.store_visitor_daily_keys FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.trg_visits_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stat_date DATE;
  v_is_new_ip BOOLEAN := false;
  v_inserted INT;
BEGIN
  v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;

  IF NEW.visitor_ip IS NOT NULL AND trim(NEW.visitor_ip) <> '' THEN
    INSERT INTO public.store_visitor_daily_keys (owner_id, stat_date, visitor_ip)
    VALUES (NEW.owner_id, v_stat_date, NEW.visitor_ip)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_is_new_ip := v_inserted > 0;
  END IF;

  INSERT INTO public.store_daily_stats (owner_id, stat_date, visit_count, unique_visitors)
  VALUES (NEW.owner_id, v_stat_date, 1, CASE WHEN v_is_new_ip THEN 1 ELSE 0 END)
  ON CONFLICT (owner_id, stat_date) DO UPDATE SET
    visit_count = store_daily_stats.visit_count + 1,
    unique_visitors = store_daily_stats.unique_visitors + CASE WHEN v_is_new_ip THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Storefront product listing — keyset pagination + archived filter
CREATE INDEX IF NOT EXISTS idx_products_owner_storefront_created
  ON public.products (owner_id, created_at DESC, id DESC)
  WHERE archived_at IS NULL AND COALESCE(is_active, true) = true;

-- ---------------------------------------------------------------------------
-- 4) get_store_meta — resolve owner once, fetch by owner_id
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
    'payment_methods', ss.payment_methods
  ) INTO v_store
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
      'payment_methods', '["cash_on_delivery"]'::jsonb
    ) INTO v_store
    FROM public.stores st
    WHERE st.user_id = v_owner_id
    LIMIT 1;
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

  RETURN jsonb_build_object('store', v_store, 'categories', v_categories);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) get_store_products_page — single owner resolve + archived filter
-- ---------------------------------------------------------------------------
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

  WITH filtered AS (
    SELECT p.*
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
  ),
  page AS (
    SELECT * FROM filtered LIMIT v_limit
  )
  SELECT
    COALESCE((SELECT jsonb_agg(public.storefront_product_json(page.*) ORDER BY page.created_at DESC, page.id DESC) FROM page), '[]'::jsonb),
    (SELECT COUNT(*) > v_limit FROM filtered),
    (SELECT page.created_at FROM page ORDER BY page.created_at ASC, page.id ASC LIMIT 1),
    (SELECT page.id FROM page ORDER BY page.created_at ASC, page.id ASC LIMIT 1)
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

-- ---------------------------------------------------------------------------
-- 6) get_storefront_page_bundle — single slug resolve, inline product page
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
  v_owner_id UUID;
  v_store JSONB;
  v_categories JSONB;
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
    'payment_methods', ss.payment_methods
  ) INTO v_store
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
      'payment_methods', '["cash_on_delivery"]'::jsonb
    ) INTO v_store
    FROM public.stores st
    WHERE st.user_id = v_owner_id
    LIMIT 1;
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

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);

  IF NULLIF(trim(p_cursor), '') IS NOT NULL AND position('|' IN trim(p_cursor)) > 0 THEN
    v_cursor_ts := split_part(trim(p_cursor), '|', 1)::timestamptz;
    v_cursor_id := split_part(trim(p_cursor), '|', 2)::uuid;
  END IF;

  WITH filtered AS (
    SELECT p.*
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
  ),
  page AS (
    SELECT * FROM filtered LIMIT v_limit
  )
  SELECT
    COALESCE((SELECT jsonb_agg(public.storefront_product_json(page.*) ORDER BY page.created_at DESC, page.id DESC) FROM page), '[]'::jsonb),
    (SELECT COUNT(*) > v_limit FROM filtered),
    (SELECT page.created_at FROM page ORDER BY page.created_at ASC, page.id ASC LIMIT 1),
    (SELECT page.id FROM page ORDER BY page.created_at ASC, page.id ASC LIMIT 1)
  INTO v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  ELSE
    v_next_cursor := NULL;
    v_has_more := false;
  END IF;

  RETURN jsonb_build_object(
    'store', v_store,
    'categories', v_categories,
    'products', COALESCE(v_products, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

-- Note: bundle inlines meta + categories + products with a single owner resolve.

-- ---------------------------------------------------------------------------
-- 7) Visit tracking — indexed slug resolve + early dedupe exit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_store_visit_by_slug(
  p_store_slug TEXT,
  p_page_path TEXT DEFAULT '/',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_ip TEXT;
  v_path TEXT;
BEGIN
  IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_store_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slug');
  END IF;

  v_owner := public._resolve_store_owner_by_slug(p_store_slug);
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(current_setting('request.headers', true)::json->>'x-real-ip', ''),
    '0.0.0.0'
  );

  v_path := COALESCE(NULLIF(trim(p_page_path), ''), '/');

  IF EXISTS (
    SELECT 1
    FROM public.store_visits sv
    WHERE sv.owner_id = v_owner
      AND sv.visitor_ip = v_ip
      AND sv.page_path = v_path
      AND sv.created_at > NOW() - INTERVAL '5 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  IF NOT public.is_valid_store_visit(v_owner, v_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent)
  VALUES (v_owner, v_ip, v_path, p_user_agent);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_storefront_page_bundle(TEXT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_page_bundle(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_store_meta(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_products_page(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;

ANALYZE public.store_settings;
ANALYZE public.stores;
ANALYZE public.products;
ANALYZE public.store_visits;
ANALYZE public.store_visitor_daily_keys;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (32, 'scale_500_to_1000: slug resolver, bundle pass, visit rollup O(1), storefront index')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
