-- Merchant catalog sync: archived products + unified owner listing (all lifecycle states)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_owner_lifecycle
  ON public.products (owner_id, archived_at, is_active, created_at DESC);

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

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
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
      p.sizes, p.colors, p.variants, p.is_active, p.archived_at,
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN duplicate_object THEN NULL;
END;
$$;
