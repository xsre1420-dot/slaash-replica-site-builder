-- Scalability: paginated storefront/admin reads, slim JSON, indexes

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_owner_active_created
  ON public.products (owner_id, created_at DESC)
  WHERE COALESCE(is_active, true) = true;

CREATE INDEX IF NOT EXISTS idx_products_owner_category_created
  ON public.products (owner_id, category, created_at DESC)
  WHERE COALESCE(is_active, true) = true;

CREATE INDEX IF NOT EXISTS idx_orders_owner_status_created
  ON public.orders (owner_id, status, created_at DESC);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_price NUMERIC;

-- =============================================================================
-- Slim storefront product JSON (excludes cost)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.storefront_product_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'category', p.category,
    'price', p.price,
    'image_url', p.image_url,
    'additional_images', p.additional_images,
    'stock_quantity', p.stock_quantity,
    'sizes', p.sizes,
    'colors', p.colors,
    'variants', p.variants,
    'discount_type', p.discount_type,
    'discount_value', p.discount_value,
    'discount_start_date', p.discount_start_date,
    'discount_end_date', p.discount_end_date,
    'original_price', p.original_price,
    'created_at', p.created_at
  );
END;
$$;

-- =============================================================================
-- Store meta only (settings + categories, no products)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_store_meta(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store JSONB;
  v_categories JSONB;
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'owner_id', s.owner_id,
    'store_name', s.store_name,
    'store_logo', s.store_logo,
    'store_slug', s.store_slug,
    'menu_background_color', s.menu_background_color,
    'menu_text_color', s.menu_text_color,
    'menu_accent_color', s.menu_accent_color,
    'store_font', s.store_font,
    'banner_images', s.banner_images,
    'primary_banner_index', s.primary_banner_index,
    'delivery_prices', s.delivery_prices,
    'whatsapp_number', s.whatsapp_number,
    'facebook_url', s.facebook_url,
    'instagram_url', s.instagram_url,
    'return_policy', s.return_policy,
    'privacy_policy', s.privacy_policy,
    'payment_methods', s.payment_methods
  ) INTO v_store
  FROM store_settings s
  WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  v_owner_id := (v_store->>'owner_id')::UUID;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', c.id, 'name', c.name, 'display_order', c.display_order)
    ORDER BY c.display_order ASC
  ), '[]'::jsonb)
  INTO v_categories
  FROM categories c
  WHERE c.owner_id = v_owner_id;

  RETURN jsonb_build_object('store', v_store, 'categories', v_categories);
END;
$$;

-- =============================================================================
-- Paginated storefront products — cursor format: "created_at|uuid"
-- =============================================================================

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

  SELECT s.owner_id INTO v_owner_id
  FROM store_settings s
  WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

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
    FROM products p
    WHERE p.owner_id = v_owner_id
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

-- =============================================================================
-- Paginated owner products (merchant admin)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_owner_products_page(
  p_owner_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_offset INT;
  v_total BIGINT;
  v_products JSONB;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COUNT(*) INTO v_total
  FROM products p
  WHERE p.owner_id = p_owner_id
    AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR p.name ILIKE '%' || trim(p_search) || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(sub) ORDER BY sub.created_at DESC), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      p.id, p.name, p.description, p.category, p.price, p.cost,
      p.image_url, p.additional_images, p.stock_quantity, p.min_stock_level,
      p.sizes, p.colors, p.variants, p.is_active,
      p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date, p.original_price,
      p.created_at, p.updated_at
    FROM products p
    WHERE p.owner_id = p_owner_id
      AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR p.name ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'products', COALESCE(v_products, '[]'::jsonb),
    'total', v_total,
    'has_more', (v_offset + v_limit) < v_total
  );
END;
$$;

-- =============================================================================
-- Paginated owner orders with server-side search
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_owner_orders_page(
  p_owner_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_offset INT;
  v_total BIGINT;
  v_orders JSONB;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('orders', '[]'::jsonb, 'total', 0, 'has_more', false);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COUNT(*) INTO v_total
  FROM orders o
  WHERE o.owner_id = p_owner_id
    AND (p_status IS NULL OR trim(p_status) = '' OR o.status = trim(p_status))
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR o.customer_name ILIKE '%' || trim(p_search) || '%'
      OR o.customer_phone ILIKE '%' || trim(p_search) || '%'
      OR o.id::text ILIKE '%' || trim(p_search) || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(sub) ORDER BY sub.created_at DESC), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT
      o.id, o.status, o.total_amount, o.created_at, o.updated_at,
      o.customer_name, o.customer_phone, o.customer_address,
      o.customer_governorate, o.notes, o.coupon_code, o.discount_amount, o.payment_method
    FROM orders o
    WHERE o.owner_id = p_owner_id
      AND (p_status IS NULL OR trim(p_status) = '' OR o.status = trim(p_status))
      AND (p_date_from IS NULL OR o.created_at >= p_date_from)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR o.customer_name ILIKE '%' || trim(p_search) || '%'
        OR o.customer_phone ILIKE '%' || trim(p_search) || '%'
        OR o.id::text ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY o.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'total', v_total,
    'has_more', (v_offset + v_limit) < v_total
  );
END;
$$;

-- =============================================================================
-- get_store_bundle: meta only (products via get_store_products_page)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_store_bundle(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta JSONB;
  v_first_page JSONB;
BEGIN
  v_meta := public.get_store_meta(p_slug);
  IF v_meta IS NULL THEN
    RETURN NULL;
  END IF;

  v_first_page := public.get_store_products_page(p_slug, 24, NULL, NULL, NULL);

  RETURN v_meta || jsonb_build_object(
    'products', COALESCE(v_first_page->'products', '[]'::jsonb),
    'products_next_cursor', v_first_page->'next_cursor',
    'products_has_more', COALESCE((v_first_page->>'has_more')::boolean, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_meta(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_products_page(TEXT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_owner_orders_page(UUID, INT, INT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_store_meta(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_products_page(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_products_page(UUID, INT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_orders_page(UUID, INT, INT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_bundle(TEXT) TO anon, authenticated;
