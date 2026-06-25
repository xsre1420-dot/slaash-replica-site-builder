-- v50: Single-product merchant RPC — one round-trip for edit/preview paths

CREATE OR REPLACE FUNCTION public.get_merchant_product_by_id(
  p_product_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_row public.products%ROWTYPE;
BEGIN
  IF v_owner IS NULL OR p_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.owner_id = v_owner
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'description', v_row.description,
    'short_description', v_row.short_description,
    'category', v_row.category,
    'price', v_row.price,
    'cost', v_row.cost,
    'original_price', v_row.original_price,
    'image_url', v_row.image_url,
    'additional_images', v_row.additional_images,
    'stock_quantity', v_row.stock_quantity,
    'sizes', v_row.sizes,
    'colors', v_row.colors,
    'variants', v_row.variants,
    'discount_type', v_row.discount_type,
    'discount_value', v_row.discount_value,
    'discount_start_date', v_row.discount_start_date,
    'discount_end_date', v_row.discount_end_date,
    'is_active', v_row.is_active,
    'archived_at', v_row.archived_at,
    'sku', v_row.sku,
    'seo_title', v_row.seo_title,
    'seo_description', v_row.seo_description,
    'product_slug', v_row.product_slug,
    'tags', v_row.tags,
    'low_stock_threshold', v_row.low_stock_level,
    'min_stock_level', v_row.min_stock_level,
    'store_id', v_row.store_id,
    'owner_id', v_row.owner_id,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_product_by_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_merchant_product_by_id(UUID) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (50, 'merchant_product_by_id: single-RPC detail fetch for edit/preview paths')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
