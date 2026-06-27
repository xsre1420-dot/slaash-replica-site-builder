-- Multi-tenant isolation hardening: storage RLS, slug-bound RPCs, revoke enumerable owner_id APIs

-- =============================================================================
-- Fix storage: drop permissive cross-tenant write policies
-- =============================================================================

DROP POLICY IF EXISTS "product_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_delete" ON storage.objects;

-- Ensure owner-scoped write policies exist (idempotent)
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;

CREATE POLICY "Users can upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================================================
-- Slug-bound catalog RPCs (no raw owner_id from client)
-- =============================================================================

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
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_store_categories_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  display_order INTEGER
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
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.display_order
  FROM categories c
  WHERE c.owner_id = v_owner_id
  ORDER BY c.display_order ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_suggested_products_for_store(
  p_slug TEXT,
  p_product_id UUID
)
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
  IF p_slug IS NULL OR p_product_id IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id AND p.owner_id = v_owner_id
  ) THEN
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
      COALESCE(sp.display_order, 0) AS sort_order
    FROM suggested_products sp
    JOIN products p ON p.id = sp.suggested_product_id AND p.owner_id = v_owner_id
    WHERE sp.product_id = p_product_id
      AND COALESCE(p.is_active, true) = true
    ORDER BY sort_order
    LIMIT 4
  ) sub;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_approved_product_reviews(
  p_slug TEXT,
  p_product_id UUID
)
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
  IF p_slug IS NULL OR p_product_id IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id AND p.owner_id = v_owner_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'reviewer_name', r.reviewer_name,
      'rating', r.rating,
      'comment', r.comment,
      'created_at', r.created_at,
      'helpful_count', COALESCE(r.helpful_count, 0)
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM product_reviews r
  WHERE r.product_id = p_product_id
    AND r.owner_id = v_owner_id
    AND r.is_approved = true;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_product_review_for_store(
  p_slug TEXT,
  p_product_id UUID,
  p_reviewer_name TEXT,
  p_rating INT,
  p_comment TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_review_id UUID;
BEGIN
  IF p_slug IS NULL OR p_product_id IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF p_reviewer_name IS NULL OR trim(p_reviewer_name) = ''
     OR p_comment IS NULL OR length(trim(p_comment)) < 2
     OR p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id AND p.owner_id = v_owner_id AND COALESCE(p.is_active, true) = true
  ) THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  INSERT INTO product_reviews (
    product_id, owner_id, reviewer_name, reviewer_email,
    rating, comment, is_approved
  ) VALUES (
    p_product_id, v_owner_id, trim(p_reviewer_name), NULL,
    p_rating, trim(p_comment), false
  ) RETURNING id INTO v_review_id;

  RETURN jsonb_build_object('success', true, 'review_id', v_review_id);
END;
$$;

-- Slug-bound coupon validation (prevents cross-tenant coupon probing by owner_id)
CREATE OR REPLACE FUNCTION public.validate_store_coupon_by_slug(
  p_slug TEXT,
  p_code TEXT,
  p_subtotal DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_coupon RECORD;
  v_discount DECIMAL := 0;
BEGIN
  IF p_slug IS NULL OR p_code IS NULL OR trim(p_code) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon');
  END IF;

  IF COALESCE(p_subtotal, 0) <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon');
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon');
  END IF;

  SELECT * INTO v_coupon
  FROM marketing_coupons
  WHERE owner_id = v_owner_id
    AND UPPER(code) = UPPER(trim(p_code))
    AND is_active = true
    AND start_date <= NOW()
    AND (end_date IS NULL OR end_date >= NOW())
    AND (usage_limit IS NULL OR used_count < usage_limit)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon');
  END IF;

  IF p_subtotal < COALESCE(v_coupon.minimum_order_amount, 0) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum order not met');
  END IF;

  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := ROUND(p_subtotal * (v_coupon.discount_value / 100), 2);
  ELSE
    v_discount := LEAST(v_coupon.discount_value, p_subtotal);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_amount', v_discount,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'code', v_coupon.code
  );
END;
$$;

-- Grants for slug-bound public RPCs
REVOKE ALL ON FUNCTION public.get_store_products_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_products_by_slug(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_store_categories_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_categories_by_slug(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_suggested_products_for_store(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_suggested_products_for_store(TEXT, UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_approved_product_reviews(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_approved_product_reviews(TEXT, UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_product_review_for_store(TEXT, UUID, TEXT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_product_review_for_store(TEXT, UUID, TEXT, INT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_store_coupon_by_slug(TEXT, TEXT, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_store_coupon_by_slug(TEXT, TEXT, DECIMAL) TO anon, authenticated;

-- Revoke raw owner_id enumeration RPCs from public clients (legacy functions may be absent)
DO $$
BEGIN
  IF to_regprocedure('public.get_store_products(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_store_products(UUID) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_store_products(UUID) TO service_role;
  END IF;
  IF to_regprocedure('public.get_store_categories(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_store_categories(UUID) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_store_categories(UUID) TO service_role;
  END IF;
END $$;

-- Restrict legacy coupon validation: authenticated merchants may only validate their own coupons
CREATE OR REPLACE FUNCTION public.validate_store_coupon(
  p_owner_id UUID,
  p_code TEXT,
  p_subtotal DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount DECIMAL := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon');
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' OR COALESCE(p_subtotal, 0) <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon');
  END IF;

  SELECT * INTO v_coupon
  FROM marketing_coupons
  WHERE owner_id = p_owner_id
    AND UPPER(code) = UPPER(trim(p_code))
    AND is_active = true
    AND start_date <= NOW()
    AND (end_date IS NULL OR end_date >= NOW())
    AND (usage_limit IS NULL OR used_count < usage_limit)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon');
  END IF;

  IF p_subtotal < COALESCE(v_coupon.minimum_order_amount, 0) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum order not met');
  END IF;

  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := ROUND(p_subtotal * (v_coupon.discount_value / 100), 2);
  ELSE
    v_discount := LEAST(v_coupon.discount_value, p_subtotal);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_amount', v_discount,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'code', v_coupon.code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_store_coupon(UUID, TEXT, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_store_coupon(UUID, TEXT, DECIMAL) TO authenticated;
