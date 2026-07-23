-- Fix product discount saves failing with patch_failed (null JSON fields + safe lock helper)

CREATE OR REPLACE FUNCTION public.apply_merchant_lock_defaults(
  p_lock_timeout_ms INT DEFAULT 5000,
  p_statement_timeout_ms INT DEFAULT 15000
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('lock_timeout', GREATEST(p_lock_timeout_ms, 1000)::text, true);
  PERFORM set_config('statement_timeout', GREATEST(p_statement_timeout_ms, 3000)::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.patch_merchant_product(
  p_product_id UUID,
  p_owner_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing public.products%ROWTYPE;
  v_allowed TEXT[] := ARRAY[
    'name', 'description', 'short_description', 'category', 'price', 'cost', 'original_price',
    'image_url', 'additional_images', 'sizes', 'colors', 'variants',
    'discount_type', 'discount_value', 'discount_start_date', 'discount_end_date',
    'is_active', 'archived_at', 'sku', 'seo_title', 'seo_description', 'product_slug',
    'tags', 'low_stock_threshold', 'min_stock_level'
  ];
  v_key TEXT;
  v_filtered JSONB := '{}'::jsonb;
  v_merged JSONB;
BEGIN
  BEGIN
    PERFORM public.apply_merchant_lock_defaults(4000, 10000);
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;

  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_patch IS NULL OR p_patch = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_key = ANY (v_allowed) THEN
      v_filtered := v_filtered || jsonb_build_object(v_key, p_patch->v_key);
    END IF;
  END LOOP;

  IF v_filtered = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_allowed_fields');
  END IF;

  SELECT * INTO v_existing
  FROM public.products
  WHERE id = p_product_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_merged := to_jsonb(v_existing) || v_filtered;

  IF to_jsonb(v_existing) - 'updated_at' - 'stock_quantity'
     IS NOT DISTINCT FROM v_merged - 'updated_at' - 'stock_quantity' THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'product_id', p_product_id);
  END IF;

  UPDATE public.products p
  SET
    name = COALESCE((v_merged->>'name')::text, p.name),
    description = COALESCE((v_merged->>'description')::text, p.description),
    short_description = COALESCE((v_merged->>'short_description')::text, p.short_description),
    category = COALESCE((v_merged->>'category')::text, p.category),
    price = COALESCE((v_merged->>'price')::numeric, p.price),
    cost = COALESCE((v_merged->>'cost')::numeric, p.cost),
    original_price = CASE
      WHEN v_filtered ? 'original_price' AND jsonb_typeof(v_filtered->'original_price') = 'null' THEN NULL
      WHEN v_filtered ? 'original_price' THEN (v_filtered->>'original_price')::numeric
      ELSE p.original_price
    END,
    image_url = COALESCE((v_merged->>'image_url')::text, p.image_url),
    additional_images = COALESCE(v_merged->'additional_images', p.additional_images),
    sizes = COALESCE(v_merged->'sizes', p.sizes),
    colors = COALESCE(v_merged->'colors', p.colors),
    variants = COALESCE(v_merged->'variants', p.variants),
    discount_type = COALESCE((v_merged->>'discount_type')::text, p.discount_type),
    discount_value = COALESCE((v_merged->>'discount_value')::numeric, p.discount_value),
    discount_start_date = CASE
      WHEN v_filtered ? 'discount_start_date' AND jsonb_typeof(v_filtered->'discount_start_date') = 'null' THEN NULL
      WHEN v_filtered ? 'discount_start_date' THEN (v_filtered->>'discount_start_date')::timestamptz
      ELSE p.discount_start_date
    END,
    discount_end_date = CASE
      WHEN v_filtered ? 'discount_end_date' AND jsonb_typeof(v_filtered->'discount_end_date') = 'null' THEN NULL
      WHEN v_filtered ? 'discount_end_date' THEN (v_filtered->>'discount_end_date')::timestamptz
      ELSE p.discount_end_date
    END,
    is_active = COALESCE((v_merged->>'is_active')::boolean, p.is_active),
    archived_at = CASE
      WHEN v_merged ? 'archived_at' THEN (v_merged->>'archived_at')::timestamptz
      ELSE p.archived_at
    END,
    sku = COALESCE((v_merged->>'sku')::text, p.sku),
    seo_title = COALESCE((v_merged->>'seo_title')::text, p.seo_title),
    seo_description = COALESCE((v_merged->>'seo_description')::text, p.seo_description),
    product_slug = COALESCE((v_merged->>'product_slug')::text, p.product_slug),
    tags = COALESCE(v_merged->'tags', p.tags),
    low_stock_threshold = COALESCE((v_merged->>'low_stock_threshold')::int, p.low_stock_threshold),
    min_stock_level = COALESCE((v_merged->>'min_stock_level')::int, p.min_stock_level),
    updated_at = NOW()
  WHERE id = p_product_id AND owner_id = p_owner_id;

  RETURN jsonb_build_object('success', true, 'noop', false, 'product_id', p_product_id);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'lock_contention');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_discount_data');
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'patch_failed',
      'error_code', SQLSTATE
    );
END;
$$;

REVOKE ALL ON FUNCTION public.patch_merchant_product(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_merchant_product(UUID, UUID, JSONB) TO authenticated;

-- Coupon write RPC (avoids direct-table edge cases; same validation as UI)
CREATE OR REPLACE FUNCTION public.create_merchant_coupon(
  p_owner_id UUID,
  p_coupon JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
  v_discount_type TEXT;
  v_discount_value NUMERIC;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_code := upper(trim(COALESCE(p_coupon->>'code', '')));
  v_discount_type := trim(COALESCE(p_coupon->>'discount_type', ''));
  v_discount_value := COALESCE((p_coupon->>'discount_value')::numeric, 0);

  IF v_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_discount_type NOT IN ('percentage', 'fixed_amount') OR v_discount_value <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_discount');
  END IF;

  INSERT INTO public.marketing_coupons (
    owner_id,
    code,
    discount_type,
    discount_value,
    minimum_order_amount,
    usage_limit,
    start_date,
    end_date,
    description,
    is_active,
    used_count
  ) VALUES (
    p_owner_id,
    v_code,
    v_discount_type,
    v_discount_value,
    COALESCE((p_coupon->>'minimum_order_amount')::numeric, 0),
    NULLIF(p_coupon->>'usage_limit', '')::int,
    COALESCE((p_coupon->>'start_date')::timestamptz, NOW()),
    NULLIF(p_coupon->>'end_date', '')::timestamptz,
    NULLIF(trim(COALESCE(p_coupon->>'description', '')), ''),
    COALESCE((p_coupon->>'is_active')::boolean, true),
    0
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_code');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_discount');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'coupon_create_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.create_merchant_coupon(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_merchant_coupon(UUID, JSONB) TO authenticated;
