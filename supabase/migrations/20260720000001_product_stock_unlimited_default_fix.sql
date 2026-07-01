-- v98: Default new products to unlimited stock when merchant leaves quantity empty.
-- Fixes storefront showing "نفذ المخزون" on products that exist but were saved with stock_quantity = 0.

CREATE OR REPLACE FUNCTION public.create_merchant_product_with_stock(
  p_owner_id UUID,
  p_payload JSONB,
  p_initial_stock INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_store_id UUID;
  v_stock INT;
  v_inserted INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_payload');
  END IF;

  IF NULLIF(trim(p_payload->>'name'), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  IF NULLIF(trim(p_payload->>'image_url'), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'image_required');
  END IF;

  v_store_id := NULLIF(p_payload->>'store_id', '')::UUID;
  IF v_store_id IS NOT NULL AND v_store_id NOT IN (SELECT public.auth_user_store_ids()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_stock := CASE
    WHEN p_payload ? 'stock_quantity' AND jsonb_typeof(p_payload->'stock_quantity') = 'null' THEN NULL
    WHEN p_payload ? 'stock_quantity' AND (p_payload->>'stock_quantity') IS NOT NULL THEN
      GREATEST((p_payload->>'stock_quantity')::INT, 0)
    WHEN p_initial_stock IS NOT NULL THEN GREATEST(p_initial_stock, 0)
    ELSE NULL
  END;

  INSERT INTO public.products (
    owner_id,
    store_id,
    name,
    description,
    short_description,
    category,
    price,
    cost,
    original_price,
    image_url,
    additional_images,
    stock_quantity,
    sizes,
    colors,
    variants,
    is_active,
    archived_at,
    min_stock_level,
    low_stock_threshold,
    sku,
    seo_title,
    seo_description,
    product_slug,
    tags
  ) VALUES (
    p_owner_id,
    v_store_id,
    trim(p_payload->>'name'),
    NULLIF(p_payload->>'description', ''),
    NULLIF(p_payload->>'short_description', ''),
    COALESCE(NULLIF(p_payload->>'category', ''), ''),
    GREATEST(COALESCE((p_payload->>'price')::numeric, 0), 0),
    NULLIF(p_payload->>'cost', '')::numeric,
    NULLIF(p_payload->>'original_price', '')::numeric,
    trim(p_payload->>'image_url'),
    COALESCE(p_payload->'additional_images', '[]'::jsonb),
    v_stock,
    CASE
      WHEN p_payload ? 'sizes' AND jsonb_typeof(p_payload->'sizes') = 'array' THEN
        ARRAY(SELECT jsonb_array_elements_text(p_payload->'sizes'))
      ELSE NULL
    END,
    CASE
      WHEN p_payload ? 'colors' AND jsonb_typeof(p_payload->'colors') <> 'null' THEN p_payload->'colors'
      ELSE NULL
    END,
    CASE
      WHEN p_payload ? 'variants' AND jsonb_typeof(p_payload->'variants') <> 'null' THEN p_payload->'variants'
      ELSE NULL
    END,
    COALESCE((p_payload->>'is_active')::boolean, true),
    NULLIF(p_payload->>'archived_at', '')::timestamptz,
    COALESCE((p_payload->>'min_stock_level')::int, (p_payload->>'low_stock_threshold')::int, 3),
    COALESCE((p_payload->>'low_stock_threshold')::int, 3),
    NULLIF(p_payload->>'sku', ''),
    NULLIF(p_payload->>'seo_title', ''),
    NULLIF(p_payload->>'seo_description', ''),
    NULLIF(p_payload->>'product_slug', ''),
    CASE
      WHEN p_payload ? 'tags' AND jsonb_typeof(p_payload->'tags') = 'array' THEN
        ARRAY(SELECT jsonb_array_elements_text(p_payload->'tags'))
      ELSE NULL
    END
  )
  RETURNING id INTO v_product_id;

  IF COALESCE(v_stock, 0) > 0 THEN
    INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
    VALUES (v_product_id, p_owner_id, v_stock, 'initial_stock')
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'product_id', v_product_id,
    'initial_stock', v_stock
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_product');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_create_failed', 'detail', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.create_merchant_product_with_stock(UUID, JSONB, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_merchant_product_with_stock(UUID, JSONB, INT) TO authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (98, 'product create: unlimited stock when quantity omitted (fix false out-of-stock on storefront)')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
