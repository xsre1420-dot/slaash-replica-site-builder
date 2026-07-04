-- v95: Storefront product JSON — expose merchant short description, tags, SKU, compare-at on cards

CREATE OR REPLACE FUNCTION public.storefront_product_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'short_description', NULLIF(trim(p.short_description), ''),
      'category', p.category,
      'price', p.price,
      'original_price', p.original_price,
      'image_url', p.image_url,
      'additional_images', p.additional_images,
      'stock_quantity', p.stock_quantity,
      'sizes', CASE WHEN p.sizes IS NULL OR cardinality(p.sizes) = 0 THEN NULL ELSE to_jsonb(p.sizes) END,
      'colors', CASE WHEN p.colors IS NULL OR p.colors = '[]'::jsonb THEN NULL ELSE p.colors END,
      'variants', public.storefront_compact_variants(p.variants),
      'discount_type', p.discount_type,
      'discount_value', p.discount_value,
      'discount_start_date', p.discount_start_date,
      'discount_end_date', p.discount_end_date,
      'sku', NULLIF(trim(p.sku), ''),
      'tags', CASE WHEN p.tags IS NULL OR p.tags = '[]'::jsonb THEN NULL ELSE p.tags END,
      'product_slug', NULLIF(trim(p.product_slug), ''),
      'created_at', p.created_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_list_json(p public.products)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_has_discount BOOLEAN;
  v_sale_price NUMERIC;
  v_status TEXT;
  v_qty INT;
  v_rating NUMERIC;
  v_list_price NUMERIC;
BEGIN
  v_has_discount := public.storefront_discount_active(p);
  v_sale_price := public.storefront_effective_unit_price(p);
  v_status := public.storefront_product_stock_status(p);
  v_qty := public.storefront_product_list_qty(p);

  v_list_price := CASE
    WHEN v_has_discount THEN COALESCE(p.original_price, p.price)
    WHEN p.original_price IS NOT NULL AND p.original_price > p.price THEN p.original_price
    ELSE NULL
  END;

  SELECT ROUND(AVG(r.rating)::numeric, 1)
  INTO v_rating
  FROM public.product_reviews r
  WHERE r.product_id = p.id
    AND COALESCE(r.is_approved, false) = true;

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'id', p.id,
      'slug', NULLIF(trim(p.product_slug), ''),
      'name', p.name,
      'short_description', NULLIF(left(COALESCE(p.short_description, p.description, ''), 120), ''),
      'price', p.price,
      'sale_price', CASE
        WHEN v_has_discount AND v_sale_price IS DISTINCT FROM p.price THEN v_sale_price
        WHEN v_list_price IS NOT NULL AND v_list_price > p.price THEN p.price
        ELSE NULL
      END,
      'original_price', v_list_price,
      'thumbnail', p.image_url,
      'category', NULLIF(trim(p.category), ''),
      'stock_status', v_status,
      'qty', CASE WHEN v_status = 'unlimited' THEN NULL ELSE v_qty END,
      'has_options', CASE WHEN public.storefront_product_has_options(p) THEN true ELSE NULL END,
      'rating', v_rating,
      'discount_type', CASE WHEN v_has_discount THEN p.discount_type ELSE NULL END,
      'discount_value', CASE WHEN v_has_discount THEN p.discount_value ELSE NULL END,
      'created_at', p.created_at,
      'image_url', p.image_url,
      'stock_quantity', CASE WHEN v_status = 'unlimited' THEN NULL ELSE v_qty END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.storefront_product_json(public.products) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_product_list_json(public.products) TO anon, authenticated;
