-- Checkout fixes: effective product price, nullable stock, persist delivery_fee

CREATE OR REPLACE FUNCTION public.effective_product_unit_price(
  p_price DECIMAL,
  p_original_price DECIMAL,
  p_discount_type TEXT,
  p_discount_value DECIMAL,
  p_discount_start TIMESTAMPTZ,
  p_discount_end TIMESTAMPTZ
) RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base DECIMAL;
BEGIN
  v_base := COALESCE(p_original_price, p_price, 0);

  IF p_discount_type IS NULL OR p_discount_type IN ('', 'none') OR COALESCE(p_discount_value, 0) <= 0 THEN
    RETURN COALESCE(p_price, 0);
  END IF;

  IF p_discount_start IS NOT NULL AND p_discount_start > NOW() THEN
    RETURN COALESCE(p_price, 0);
  END IF;

  IF p_discount_end IS NOT NULL AND p_discount_end < NOW() THEN
    RETURN COALESCE(p_price, 0);
  END IF;

  IF p_discount_type = 'percentage' THEN
    RETURN GREATEST(0, ROUND(v_base * (1 - p_discount_value / 100)));
  END IF;

  IF p_discount_type = 'amount' THEN
    RETURN GREATEST(0, v_base - p_discount_value);
  END IF;

  RETURN COALESCE(p_price, 0);
END;
$$;

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
    RETURN jsonb_build_object('success', false, 'error', 'customer_info_required');
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
    SELECT
      COALESCE(stock_quantity, 2147483647),
      public.effective_product_unit_price(
        price, original_price, discount_type, discount_value, discount_start_date, discount_end_date
      ),
      variants
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
      RETURN jsonb_build_object('success', false, 'error', 'insufficient stock');
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'total_amount_mismatch',
      'expected_total', v_computed_total
    );
  END IF;

  INSERT INTO orders (
    id, owner_id, idempotency_key, customer_name, customer_phone, customer_address,
    total_amount, status, notes, customer_governorate, payment_method,
    coupon_code, discount_amount, delivery_fee, created_at, updated_at
  ) VALUES (
    COALESCE(p_order_id, gen_random_uuid()),
    v_effective_owner,
    NULLIF(trim(p_idempotency_key), ''),
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_customer_address),
    v_computed_total,
    'pending',
    NULLIF(trim(p_notes), ''),
    NULLIF(trim(p_customer_governorate), ''),
    COALESCE(NULLIF(trim(p_payment_method), ''), 'cash_on_delivery'),
    NULLIF(upper(trim(p_coupon_code)), ''),
    v_coupon_discount,
    COALESCE(v_delivery_fee, 0),
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
    public.effective_product_unit_price(
      p.price, p.original_price, p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date
    ),
    (item->>'quantity')::INT,
    public.effective_product_unit_price(
      p.price, p.original_price, p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date
    ) * (item->>'quantity')::INT,
    jsonb_build_object(
      'selected_size', item->>'selected_size',
      'selected_color', item->>'selected_color'
    ),
    NOW()
  FROM jsonb_array_elements(p_items) AS t(item)
  JOIN products p ON p.id = (item->>'product_id')::UUID AND p.owner_id = v_effective_owner;

  UPDATE products p
  SET stock_quantity = CASE
        WHEN p.stock_quantity IS NULL THEN NULL
        ELSE p.stock_quantity - agg.qty
      END,
      updated_at = NOW()
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id, SUM((item->>'quantity')::INT)::INT AS qty
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  ) AS agg
  WHERE p.id = agg.product_id
    AND p.owner_id = v_effective_owner
    AND (p.stock_quantity IS NULL OR p.stock_quantity >= agg.qty);

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
    'discount_amount', v_coupon_discount,
    'delivery_fee', v_delivery_fee
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.effective_product_unit_price(
  DECIMAL, DECIMAL, TEXT, DECIMAL, TIMESTAMPTZ, TIMESTAMPTZ
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO anon, authenticated;
