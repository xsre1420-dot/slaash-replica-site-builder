-- Platform schema contract (idempotent — safe to re-run on any environment).
-- Resolves RC-001: code/DB drift after Lovable → Cursor migration chain.
-- Ensures storefront, merchant catalog, checkout, and realtime share one contract.

-- ── Columns expected by the app ─────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_id UUID,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS product_slug TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 3;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS marketing_attribution JSONB;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_order_confirmation TEXT;

-- ── Storefront: published = active AND not archived (matches productLifecycle.ts) ──
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
    SELECT st.user_id INTO v_owner_id
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

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
      AND p.archived_at IS NULL
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
  END IF;

  RETURN jsonb_build_object(
    'products', COALESCE(v_products, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_products_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  price NUMERIC,
  image_url TEXT,
  additional_images TEXT[],
  colors JSONB,
  sizes TEXT[],
  variants JSONB,
  discount_type TEXT,
  discount_value NUMERIC,
  original_price NUMERIC,
  stock_quantity INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT st.user_id INTO v_owner_id
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.description, p.category, p.price,
    p.image_url, p.additional_images, p.colors, p.sizes, p.variants,
    p.discount_type, p.discount_value, p.original_price, p.stock_quantity
  FROM products p
  WHERE p.owner_id = v_owner_id
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_product_by_id(p_slug TEXT, p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_product JSONB;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM store_settings
  WHERE LOWER(store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT user_id INTO v_owner_id
    FROM stores
    WHERE LOWER(store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(p.*) INTO v_product
  FROM products p
  WHERE p.id = p_product_id
    AND p.owner_id = v_owner_id
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL;

  RETURN v_product;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_products_page(TEXT, INT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_products_by_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_product_by_id(TEXT, UUID) TO anon, authenticated;

-- ── Realtime contract (merchant order + catalog sync) ─────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
