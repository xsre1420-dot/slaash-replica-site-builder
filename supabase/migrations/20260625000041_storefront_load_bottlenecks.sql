-- v41: Storefront load-test bottlenecks — visit write pressure, bundle RPC, slug indexes
-- Target: 1000 concurrent users <1% error rate

-- ---------------------------------------------------------------------------
-- 1) Slug resolve index aligned with _resolve_store_owner_by_slug predicate
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_store_settings_slug_lower_trim
  ON public.store_settings (LOWER(trim(store_slug)))
  WHERE store_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_owner_display_order
  ON public.categories (owner_id, display_order ASC);

-- Covering index for visit dedupe hot path (owner + ip + path + time)
CREATE INDEX IF NOT EXISTS idx_store_visits_dedupe_lookup
  ON public.store_visits (owner_id, visitor_ip, page_path, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2) Visit rate limit — 120/hour per IP (shared NAT / viral traffic)
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
    OFFSET 119
    LIMIT 1
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Visit tracking — longer dedupe, soft rate-limit (no client error)
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

  -- 10-minute dedupe (matches high-traffic session patterns)
  IF EXISTS (
    SELECT 1
    FROM public.store_visits sv
    WHERE sv.owner_id = v_owner
      AND sv.visitor_ip = v_ip
      AND sv.page_path = v_path
      AND sv.created_at > NOW() - INTERVAL '10 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  IF NOT public.is_valid_store_visit(v_owner, v_ip) THEN
    RETURN jsonb_build_object('success', true, 'rate_limited', true);
  END IF;

  INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent)
  VALUES (v_owner, v_ip, v_path, LEFT(p_user_agent, 512));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) get_storefront_page_bundle — single-pass product page aggregation
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
    'store', v_store,
    'categories', v_categories,
    'products', COALESCE(v_products, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_storefront_page_bundle(TEXT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_page_bundle(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;

ANALYZE public.store_settings;
ANALYZE public.store_visits;
ANALYZE public.categories;
ANALYZE public.products;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (41, 'storefront_load: visit soft-limit, bundle single-pass, dedupe indexes')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
