-- Publish lifecycle + merchant review management

CREATE OR REPLACE FUNCTION public.resolve_store_owner_by_slug(p_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM store_settings ss
  WHERE lower(trim(ss.store_slug)) = lower(trim(p_slug))
  LIMIT 1;

  IF v_owner IS NOT NULL THEN
    RETURN v_owner;
  END IF;

  SELECT st.user_id INTO v_owner
  FROM stores st
  WHERE lower(trim(st.store_slug)) = lower(trim(p_slug))
  LIMIT 1;

  RETURN v_owner;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_owner_product(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row products%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE products
  SET is_active = true,
      archived_at = NULL,
      updated_at = NOW()
  WHERE id = p_product_id
    AND owner_id = auth.uid()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'product', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_merchant_product_reviews(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR p_product_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id AND p.owner_id = auth.uid()
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'reviewer_name', r.reviewer_name,
      'reviewer_email', r.reviewer_email,
      'rating', r.rating,
      'comment', r.comment,
      'is_approved', COALESCE(r.is_approved, false),
      'is_featured', COALESCE(r.is_featured, false),
      'helpful_count', COALESCE(r.helpful_count, 0),
      'created_at', r.created_at
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM product_reviews r
  WHERE r.product_id = p_product_id
    AND r.owner_id = auth.uid();

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_product_review(p_review_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_review_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  UPDATE product_reviews
  SET is_approved = true,
      updated_at = NOW()
  WHERE id = p_review_id
    AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object('success', true);
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

  v_owner_id := public.resolve_store_owner_by_slug(p_slug);

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id
      AND p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
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

  v_owner_id := public.resolve_store_owner_by_slug(p_slug);

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

GRANT EXECUTE ON FUNCTION public.resolve_store_owner_by_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_owner_product(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_product_reviews(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_product_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_product_review_for_store(TEXT, UUID, TEXT, INT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_approved_product_reviews(TEXT, UUID) TO anon, authenticated;
