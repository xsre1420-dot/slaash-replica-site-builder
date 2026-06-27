-- Store-level suggested products shown in storefront footer (merchant picks from product management)

CREATE TABLE IF NOT EXISTS public.storefront_footer_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT storefront_footer_products_owner_product_unique UNIQUE (owner_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_storefront_footer_products_owner_order
  ON public.storefront_footer_products (owner_id, display_order);

ALTER TABLE public.storefront_footer_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage storefront footer products" ON public.storefront_footer_products;
CREATE POLICY "Owners manage storefront footer products"
  ON public.storefront_footer_products
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.get_storefront_footer_products(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_result JSONB;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    BEGIN
      SELECT s.user_id INTO v_owner_id
      FROM stores s
      WHERE LOWER(s.store_slug) = LOWER(trim(p_slug))
      LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
      v_owner_id := NULL;
    END;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_order), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'price', p.price,
        'image_url', p.image_url,
        'category', p.category
      ) AS row_data,
      COALESCE(sfp.display_order, 0) AS sort_order
    FROM storefront_footer_products sfp
    JOIN products p ON p.id = sfp.product_id AND p.owner_id = v_owner_id
    WHERE sfp.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
    ORDER BY sort_order, sfp.created_at
    LIMIT 8
  ) sub;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_footer_products(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_footer_products(TEXT) TO anon, authenticated;
