-- v34: Product lifecycle sync — storefront legacy RPC guards, publish RPC hardening

-- ---------------------------------------------------------------------------
-- 1) Legacy storefront catalog RPC — exclude archived (client fallback path)
-- ---------------------------------------------------------------------------
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

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.description, p.category, p.price,
    p.image_url, p.additional_images, p.colors, p.sizes, p.variants,
    p.discount_type, p.discount_value, p.original_price, p.stock_quantity
  FROM public.products p
  WHERE p.owner_id = v_owner_id
    AND p.archived_at IS NULL
    AND COALESCE(p.is_active, true) = true
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_products_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_products_by_slug(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) publish_owner_product — return slim product JSON (no cost leak in RPC payload)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_owner_product(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.products%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE public.products
  SET is_active = true,
      archived_at = NULL,
      updated_at = NOW()
  WHERE id = p_product_id
    AND owner_id = auth.uid()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'product', jsonb_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'description', v_row.description,
      'category', v_row.category,
      'price', v_row.price,
      'cost', v_row.cost,
      'image_url', v_row.image_url,
      'additional_images', v_row.additional_images,
      'stock_quantity', v_row.stock_quantity,
      'sizes', v_row.sizes,
      'colors', v_row.colors,
      'variants', v_row.variants,
      'is_active', v_row.is_active,
      'archived_at', v_row.archived_at,
      'discount_type', v_row.discount_type,
      'discount_value', v_row.discount_value,
      'discount_start_date', v_row.discount_start_date,
      'discount_end_date', v_row.discount_end_date,
      'original_price', v_row.original_price,
      'min_stock_level', v_row.min_stock_level,
      'created_at', v_row.created_at,
      'updated_at', v_row.updated_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_owner_product(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_owner_product(UUID) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (34, 'product_lifecycle: archived guard on slug RPC, publish_owner_product slim JSON')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
