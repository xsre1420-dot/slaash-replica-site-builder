-- P0 security & integrity fixes
-- C-01: Server-side checkout owner resolution (blocks cross-tenant order abuse)
-- S-01: get_store_for_user IDOR fix
-- S-02: product_reviews INSERT owner_id binding

-- ---------------------------------------------------------------------------
-- Helper: resolve effective store owner for checkout
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_checkout_owner(
  p_owner_id UUID,
  p_store_slug TEXT
) RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
      RAISE EXCEPTION 'unauthorized_checkout';
    END IF;
    RETURN auth.uid();
  END IF;

  IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_store_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'store_slug_required';
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM store_settings ss
  WHERE lower(trim(ss.store_slug)) = lower(trim(p_store_slug))
  LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT s.user_id INTO v_owner
    FROM stores s
    WHERE lower(trim(s.store_slug)) = lower(trim(p_store_slug))
    LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'store_not_found';
  END IF;

  RETURN v_owner;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_checkout_owner(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_checkout_owner(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Secure order RPC: add p_store_slug; derive owner server-side
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT
);

CREATE OR REPLACE FUNCTION public.create_order_with_stock_deduction(
  p_order_id UUID,
  p_owner_id UUID,
  p_idempotency_key TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_address TEXT,
  p_total_amount DECIMAL,
  p_customer_governorate TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash_on_delivery',
  p_coupon_code TEXT DEFAULT NULL,
  p_store_slug TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_product_id UUID;
  v_qty INT;
  v_stock INT;
  v_db_price DECIMAL;
  v_variants JSONB;
  v_item JSONB;
  v_line_total DECIMAL := 0;
  v_subtotal DECIMAL := 0;
  v_computed_total DECIMAL := 0;
  v_delivery_fee DECIMAL := 0;
  v_coupon_discount DECIMAL := 0;
  v_coupon RECORD;
  v_item_count INT;
  v_updated_count INT;
  v_selected_size TEXT;
  v_selected_color TEXT;
  v_variant_qty INT;
  v_found_variant BOOLEAN;
  v_variant_elem JSONB;
  v_existing_order UUID;
  v_line_qty INT;
  v_effective_owner UUID;
BEGIN
  SET LOCAL search_path = public;

  BEGIN
    v_effective_owner := public.resolve_checkout_owner(p_owner_id, p_store_slug);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END;

  IF v_effective_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existing_order
    FROM orders
    WHERE owner_id = v_effective_owner AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;

    IF v_existing_order IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing_order,
        'message', 'Order already exists',
        'idempotent', true
      );
    END IF;
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' OR
     p_customer_phone IS NULL OR trim(p_customer_phone) = '' OR
     p_customer_address IS NULL OR trim(p_customer_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_customer_governorate IS NOT NULL AND trim(p_customer_governorate) <> '' THEN
    SELECT COALESCE(
      (
        SELECT (elem->>'price')::DECIMAL
        FROM store_settings ss,
             jsonb_array_elements(COALESCE(ss.delivery_prices, '[]'::jsonb)) AS elem
        WHERE ss.owner_id = v_effective_owner
          AND elem->>'governorate' = trim(p_customer_governorate)
        LIMIT 1
      ),
      0
    ) INTO v_delivery_fee;
  END IF;

  SELECT COUNT(*)::INT
  INTO v_item_count
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'product_id') IS NOT NULL
      AND (item->>'quantity')::INT > 0
    GROUP BY (item->>'product_id')::UUID
  ) aggregated;

  IF v_item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  PERFORM 1
  FROM products p
  INNER JOIN (
    SELECT DISTINCT (item->>'product_id')::UUID AS id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'quantity')::INT > 0
  ) ids ON p.id = ids.id
  WHERE p.owner_id = v_effective_owner AND COALESCE(p.is_active, true) = true
  ORDER BY p.id
  FOR UPDATE;

  FOR v_product_id, v_qty IN
    SELECT
      (item->>'product_id')::UUID,
      SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
    ORDER BY 1
  LOOP
    SELECT COALESCE(stock_quantity, 0), price, variants
    INTO v_stock, v_db_price, v_variants
    FROM products
    WHERE id = v_product_id
      AND owner_id = v_effective_owner
      AND COALESCE(is_active, true) = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_line_total := v_db_price * v_qty;

    FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
      IF (v_item->>'product_id')::UUID <> v_product_id THEN
        CONTINUE;
      END IF;

      v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
      v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');
      v_line_qty := (v_item->>'quantity')::INT;

      IF v_variants IS NOT NULL AND jsonb_typeof(v_variants) = 'array' AND jsonb_array_length(v_variants) > 0 THEN
        v_found_variant := false;
        FOR v_variant_elem IN SELECT value FROM jsonb_array_elements(v_variants) LOOP
          IF (v_selected_size IS NULL OR v_variant_elem->>'size' = v_selected_size)
             AND (v_selected_color IS NULL OR v_variant_elem->>'color' = v_selected_color) THEN
            v_variant_qty := COALESCE((v_variant_elem->>'quantity')::INT, 0);
            IF v_variant_qty < v_line_qty THEN
              RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
            END IF;
            v_found_variant := true;
            EXIT;
          END IF;
        END LOOP;

        IF NOT v_found_variant AND (v_selected_size IS NOT NULL OR v_selected_color IS NOT NULL) THEN
          RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
        END IF;
      END IF;
    END LOOP;

    IF v_stock < v_qty THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
    FROM marketing_coupons
    WHERE owner_id = v_effective_owner
      AND upper(code) = upper(trim(p_coupon_code))
      AND is_active = true
      AND start_date <= NOW()
      AND (end_date IS NULL OR end_date >= NOW())
      AND (usage_limit IS NULL OR used_count < usage_limit)
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    IF v_subtotal < COALESCE(v_coupon.minimum_order_amount, 0) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    IF v_coupon.discount_type = 'percentage' THEN
      v_coupon_discount := ROUND(v_subtotal * (v_coupon.discount_value / 100), 2);
    ELSE
      v_coupon_discount := LEAST(v_coupon.discount_value, v_subtotal);
    END IF;

    UPDATE marketing_coupons
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = v_coupon.id;
  END IF;

  v_computed_total := v_subtotal - v_coupon_discount + COALESCE(v_delivery_fee, 0);

  IF p_total_amount IS NOT NULL AND ABS(p_total_amount - v_computed_total) > 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  INSERT INTO orders (
    id, owner_id, idempotency_key, customer_name, customer_phone, customer_address,
    total_amount, status, notes, customer_governorate, payment_method,
    coupon_code, discount_amount, created_at, updated_at
  ) VALUES (
    COALESCE(p_order_id, gen_random_uuid()),
    v_effective_owner,
    NULLIF(trim(p_idempotency_key), ''),
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_customer_address),
    v_computed_total,
    'pending',
    p_notes,
    p_customer_governorate,
    COALESCE(NULLIF(trim(p_payment_method), ''), 'cash_on_delivery'),
    NULLIF(upper(trim(p_coupon_code)), ''),
    v_coupon_discount,
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    order_id, owner_id, product_id, product_name, product_price, quantity, subtotal, variant_metadata, created_at
  )
  SELECT
    v_order_id,
    v_effective_owner,
    (item->>'product_id')::UUID,
    p.name,
    p.price,
    (item->>'quantity')::INT,
    p.price * (item->>'quantity')::INT,
    jsonb_build_object(
      'selected_size', item->>'selected_size',
      'selected_color', item->>'selected_color'
    ),
    NOW()
  FROM jsonb_array_elements(p_items) AS t(item)
  JOIN products p ON p.id = (item->>'product_id')::UUID AND p.owner_id = v_effective_owner;

  UPDATE products p
  SET stock_quantity = p.stock_quantity - agg.qty,
      updated_at = NOW()
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id, SUM((item->>'quantity')::INT)::INT AS qty
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  ) AS agg
  WHERE p.id = agg.product_id AND p.owner_id = v_effective_owner AND p.stock_quantity >= agg.qty;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_item_count THEN
    RAISE EXCEPTION 'stock_deduction_failed';
  END IF;

  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');
    v_line_qty := (v_item->>'quantity')::INT;

    IF v_selected_size IS NOT NULL OR v_selected_color IS NOT NULL THEN
      UPDATE products p
      SET variants = adjust_product_variants(p.variants, v_selected_size, v_selected_color, -v_line_qty),
          updated_at = NOW()
      WHERE p.id = (v_item->>'product_id')::UUID
        AND p.owner_id = v_effective_owner
        AND p.variants IS NOT NULL
        AND jsonb_typeof(p.variants) = 'array'
        AND jsonb_array_length(p.variants) > 0;
    END IF;
  END LOOP;

  INSERT INTO inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
  SELECT v_order_id, (item->>'product_id')::UUID, v_effective_owner, -SUM((item->>'quantity')::INT)::INT, 'order_created'
  FROM jsonb_array_elements(p_items) AS t(item)
  GROUP BY (item->>'product_id')::UUID;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_computed_total,
    'discount_amount', v_coupon_discount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- S-01: get_store_for_user — caller must match p_user_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_for_user(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT json_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'store_name', s.store_name,
      'store_slug', s.store_slug,
      'theme_id', COALESCE(s.theme_id, 'default')
    )
    FROM public.stores s
    WHERE s.user_id = p_user_id
    LIMIT 1
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- S-02: product_reviews — owner_id must match product owner
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can submit pending reviews" ON public.product_reviews;
CREATE POLICY "Public can submit pending reviews"
  ON public.product_reviews FOR INSERT
  WITH CHECK (
    is_approved = false
    AND owner_id = (SELECT p.owner_id FROM products p WHERE p.id = product_id)
    AND EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND COALESCE(p.is_active, true) = true
    )
  );
