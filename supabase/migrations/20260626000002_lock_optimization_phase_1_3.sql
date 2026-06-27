-- v73 / Phase 1.3: Enterprise lock optimization — shorter critical sections, deadlock-safe ordering
-- Lock order contract: advisory(idempotency) -> products(ORDER BY id) -> coupons -> orders -> outbox(SKIP LOCKED)

-- ---------------------------------------------------------------------------
-- 1) Shared helpers — deterministic product locking + lock session defaults
-- ---------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.lock_owner_products_ordered(
  p_owner_id UUID,
  p_items JSONB
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_count
  FROM (
    SELECT 1
    FROM public.products p
    INNER JOIN (
      SELECT DISTINCT (item->>'product_id')::UUID AS id
      FROM jsonb_array_elements(p_items) AS t(item)
      WHERE (item->>'quantity')::INT > 0
    ) ids ON p.id = ids.id
    WHERE p.owner_id = p_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
    ORDER BY p.id
    FOR UPDATE
  ) locked;

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.lock_owner_products_ordered(UUID, JSONB) IS
  'Phase 1.3: acquire row locks on checkout SKUs in deterministic UUID order (deadlock prevention)';

-- ---------------------------------------------------------------------------
-- 2) Checkout — late locks, read-only preflight, no inline side-effects batch
-- ---------------------------------------------------------------------------
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
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_product_id UUID;
  v_product_name TEXT;
  v_qty INT;
  v_stock INT;
  v_available INT;
  v_db_price DECIMAL;
  v_variants JSONB;
  v_running_variants JSONB;
  v_item JSONB;
  v_subtotal DECIMAL := 0;
  v_computed_total DECIMAL := 0;
  v_delivery_fee DECIMAL := 0;
  v_coupon_discount DECIMAL := 0;
  v_coupon RECORD;
  v_item_count INT;
  v_updated_count INT;
  v_selected_size TEXT;
  v_selected_color TEXT;
  v_line_qty INT;
  v_effective_owner UUID;
  v_recovery JSONB;
  v_ip TEXT;
  v_payment_method TEXT;
  v_payment_status TEXT;
BEGIN
  SET LOCAL search_path = public;
  PERFORM public.apply_merchant_lock_defaults(8000, 20000);

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'idempotency_required');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    '0.0.0.0'
  );

  IF NOT public.check_rpc_rate_limit(
    'checkout:' || v_ip || ':' || COALESCE(p_owner_id::text, COALESCE(p_store_slug, 'unknown')), 20, 60
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  BEGIN
    v_effective_owner := public.resolve_checkout_owner(p_owner_id, p_store_slug);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END;

  IF v_effective_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' OR
     p_customer_phone IS NULL OR trim(p_customer_phone) = '' OR
     p_customer_address IS NULL OR trim(p_customer_address) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'customer_info_required');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  v_payment_method := COALESCE(NULLIF(trim(p_payment_method), ''), 'cash_on_delivery');

  IF v_payment_method = 'cash_on_delivery' THEN
    v_payment_status := 'pending_collection';
  ELSIF v_payment_method = 'digital_wallet' THEN
    v_payment_status := 'awaiting_gateway';
  ELSE
    IF NOT public.is_payment_method_allowed(v_effective_owner, v_payment_method) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;
    v_payment_status := 'failed';
  END IF;

  SELECT COUNT(*)::INT INTO v_item_count
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'product_id') IS NOT NULL AND (item->>'quantity')::INT > 0
    GROUP BY (item->>'product_id')::UUID
  ) aggregated;

  IF v_item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  -- Read-only preflight (no row locks) — fast reject before critical section
  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_line_qty := (v_item->>'quantity')::INT;
    IF v_product_id IS NULL OR v_line_qty IS NULL OR v_line_qty <= 0 THEN CONTINUE; END IF;

    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');

    SELECT COALESCE(stock_quantity, 2147483647), variants, name
    INTO v_stock, v_variants, v_product_name
    FROM public.products
    WHERE id = v_product_id AND owner_id = v_effective_owner
      AND COALESCE(is_active, true) = true AND archived_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_available := public.product_checkout_available_qty(
      CASE WHEN v_stock = 2147483647 THEN NULL ELSE v_stock END,
      v_variants, v_selected_size, v_selected_color
    );

    IF v_available < v_line_qty THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'insufficient stock',
        'product_id', v_product_id, 'product_name', v_product_name,
        'available', v_available, 'requested', v_line_qty
      );
    END IF;
  END LOOP;

  -- Idempotency advisory lock — after cheap validation, before product row locks
  PERFORM pg_advisory_xact_lock(hashtext(v_effective_owner::text || ':' || trim(p_idempotency_key)));

  v_recovery := public.checkout_resolve_duplicate_order(v_effective_owner, p_idempotency_key, NULL);
  IF v_recovery IS NOT NULL THEN
    RETURN v_recovery;
  END IF;

  IF p_customer_governorate IS NOT NULL AND trim(p_customer_governorate) <> '' THEN
    SELECT COALESCE(
      (
        SELECT (elem->>'price')::DECIMAL
        FROM public.store_settings ss,
             jsonb_array_elements(COALESCE(ss.delivery_prices, '[]'::jsonb)) AS elem
        WHERE ss.owner_id = v_effective_owner
          AND elem->>'governorate' = trim(p_customer_governorate)
        LIMIT 1
      ),
      0
    ) INTO v_delivery_fee;
  END IF;

  v_updated_count := public.lock_owner_products_ordered(v_effective_owner, p_items);
  IF v_updated_count <> v_item_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  -- Authoritative stock check under row locks
  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_line_qty := (v_item->>'quantity')::INT;
    IF v_product_id IS NULL OR v_line_qty IS NULL OR v_line_qty <= 0 THEN CONTINUE; END IF;

    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');

    SELECT COALESCE(stock_quantity, 2147483647), variants, name
    INTO v_stock, v_variants, v_product_name
    FROM public.products
    WHERE id = v_product_id AND owner_id = v_effective_owner;

    v_available := public.product_checkout_available_qty(
      CASE WHEN v_stock = 2147483647 THEN NULL ELSE v_stock END,
      v_variants, v_selected_size, v_selected_color
    );

    IF v_available < v_line_qty THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'insufficient stock',
        'product_id', v_product_id, 'product_name', v_product_name,
        'available', v_available, 'requested', v_line_qty
      );
    END IF;
  END LOOP;

  FOR v_product_id, v_qty IN
    SELECT (item->>'product_id')::UUID, SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
    ORDER BY 1
  LOOP
    SELECT public.effective_product_unit_price(
      price, original_price, discount_type, discount_value, discount_start_date, discount_end_date
    ) INTO v_db_price
    FROM public.products
    WHERE id = v_product_id AND owner_id = v_effective_owner;

    v_subtotal := v_subtotal + v_db_price * v_qty;
  END LOOP;

  -- Coupon lock after product locks (global lock order: products -> coupons)
  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
    FROM public.marketing_coupons
    WHERE owner_id = v_effective_owner AND upper(code) = upper(trim(p_coupon_code))
      AND is_active = true AND start_date <= NOW()
      AND (end_date IS NULL OR end_date >= NOW())
      AND (usage_limit IS NULL OR used_count < usage_limit)
    ORDER BY id
    FOR UPDATE;

    IF NOT FOUND OR v_subtotal < COALESCE(v_coupon.minimum_order_amount, 0) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    IF v_coupon.discount_type = 'percentage' THEN
      v_coupon_discount := ROUND(v_subtotal * (v_coupon.discount_value / 100), 2);
    ELSE
      v_coupon_discount := LEAST(v_coupon.discount_value, v_subtotal);
    END IF;

    UPDATE public.marketing_coupons SET used_count = used_count + 1 WHERE id = v_coupon.id;
  END IF;

  v_computed_total := v_subtotal - v_coupon_discount + COALESCE(v_delivery_fee, 0);

  IF p_total_amount IS NOT NULL AND ABS(p_total_amount - v_computed_total) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'total_amount_mismatch', 'expected_total', v_computed_total
    );
  END IF;

  PERFORM set_config('app.checkout_fast_path', 'on', true);
  PERFORM set_config('app.skip_stock_sync', 'on', true);

  v_order_id := COALESCE(p_order_id, gen_random_uuid());

  INSERT INTO public.orders (
    id, owner_id, idempotency_key, customer_name, customer_phone, customer_address,
    total_amount, status, notes, customer_governorate, payment_method, payment_status,
    coupon_code, discount_amount, delivery_fee, delivery_status, created_at, updated_at
  ) VALUES (
    v_order_id, v_effective_owner, trim(p_idempotency_key),
    trim(p_customer_name), trim(p_customer_phone), trim(p_customer_address),
    v_computed_total, 'pending', NULLIF(trim(p_notes), ''),
    NULLIF(trim(p_customer_governorate), ''), v_payment_method, v_payment_status,
    NULLIF(upper(trim(p_coupon_code)), ''), v_coupon_discount, COALESCE(v_delivery_fee, 0),
    'pending', NOW(), NOW()
  );

  INSERT INTO public.payment_transactions (
    order_id, owner_id, amount, payment_method, status, provider, idempotency_key
  ) VALUES (
    v_order_id, v_effective_owner, v_computed_total, v_payment_method,
    CASE WHEN v_payment_status = 'failed' THEN 'failed' ELSE 'pending' END,
    'internal', trim(p_idempotency_key)
  )
  ON CONFLICT (order_id) DO NOTHING;

  INSERT INTO public.order_items (
    order_id, owner_id, product_id, product_name, product_price, quantity, subtotal, variant_metadata, created_at
  )
  SELECT v_order_id, v_effective_owner, (item->>'product_id')::UUID, p.name,
    public.effective_product_unit_price(
      p.price, p.original_price, p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date
    ),
    (item->>'quantity')::INT,
    public.effective_product_unit_price(
      p.price, p.original_price, p.discount_type, p.discount_value, p.discount_start_date, p.discount_end_date
    ) * (item->>'quantity')::INT,
    jsonb_build_object(
      'selected_size', NULLIF(trim(item->>'selected_size'), ''),
      'selected_color', NULLIF(trim(item->>'selected_color'), '')
    ),
    NOW()
  FROM jsonb_array_elements(p_items) AS t(item)
  JOIN public.products p ON p.id = (item->>'product_id')::UUID AND p.owner_id = v_effective_owner;

  UPDATE public.products p
  SET stock_quantity = CASE
        WHEN p.stock_quantity IS NULL THEN NULL
        WHEN p.stock_quantity >= agg.qty THEN p.stock_quantity - agg.qty
        ELSE p.stock_quantity
      END
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id, SUM((item->>'quantity')::INT)::INT AS qty
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  ) AS agg
  WHERE p.id = agg.product_id AND p.owner_id = v_effective_owner
    AND (
      p.stock_quantity IS NULL OR p.stock_quantity >= agg.qty
      OR public.product_variant_stock_sum(p.variants) >= agg.qty
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_item_count THEN
    RAISE EXCEPTION 'stock_deduction_failed' USING ERRCODE = 'P0001';
  END IF;

  FOR v_product_id IN
    SELECT DISTINCT (item->>'product_id')::UUID
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'quantity')::INT > 0
      AND (NULLIF(trim(item->>'selected_size'), '') IS NOT NULL
           OR NULLIF(trim(item->>'selected_color'), '') IS NOT NULL)
    ORDER BY 1
  LOOP
    SELECT variants INTO v_running_variants
    FROM public.products
    WHERE id = v_product_id AND owner_id = v_effective_owner
      AND variants IS NOT NULL AND jsonb_typeof(variants) = 'array' AND jsonb_array_length(variants) > 0;

    IF NOT FOUND OR v_running_variants IS NULL THEN CONTINUE; END IF;

    FOR v_item IN
      SELECT item FROM jsonb_array_elements(p_items) AS t(item)
      WHERE (item->>'product_id')::UUID = v_product_id AND (item->>'quantity')::INT > 0
        AND (NULLIF(trim(item->>'selected_size'), '') IS NOT NULL
             OR NULLIF(trim(item->>'selected_color'), '') IS NOT NULL)
    LOOP
      v_running_variants := public.adjust_product_variants(
        v_running_variants,
        NULLIF(trim(v_item->>'selected_size'), ''),
        NULLIF(trim(v_item->>'selected_color'), ''),
        -(v_item->>'quantity')::INT
      );
    END LOOP;

    UPDATE public.products p
    SET variants = v_running_variants, updated_at = NOW()
    WHERE p.id = v_product_id AND p.owner_id = v_effective_owner;
  END LOOP;

  INSERT INTO public.inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
  SELECT v_order_id, (item->>'product_id')::UUID, v_effective_owner,
         -SUM((item->>'quantity')::INT)::INT, 'order_created'
  FROM jsonb_array_elements(p_items) AS t(item)
  GROUP BY (item->>'product_id')::UUID;

  INSERT INTO public.order_side_effects_outbox (order_id, owner_id)
  VALUES (v_order_id, v_effective_owner)
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.checkout_fast_path', 'off', true);
  PERFORM set_config('app.skip_stock_sync', 'off', true);

  -- Side effects deferred entirely to background worker (no extra locks in checkout txn)
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_computed_total,
    'discount_amount', v_coupon_discount,
    'delivery_fee', v_delivery_fee,
    'side_effects_deferred', true
  );

EXCEPTION
  WHEN lock_not_available THEN
    PERFORM set_config('app.checkout_fast_path', 'off', true);
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  WHEN OTHERS THEN
    PERFORM set_config('app.checkout_fast_path', 'off', true);
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    IF SQLERRM = 'stock_deduction_failed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'insufficient stock');
    END IF;
    IF SQLERRM = 'total_amount_mismatch' THEN
      RETURN jsonb_build_object('success', false, 'error', 'total_amount_mismatch');
    END IF;
    IF SQLSTATE = '23505' THEN
      v_recovery := public.checkout_resolve_duplicate_order(v_effective_owner, p_idempotency_key, p_order_id);
      IF v_recovery IS NOT NULL THEN RETURN v_recovery; END IF;
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Order cancel stock restore — ordered product locks, skip stock sync trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  oi RECORD;
  v_size TEXT;
  v_color TEXT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    PERFORM pg_advisory_xact_lock(hashtext('order_cancel_restore:' || NEW.id::text));

    IF EXISTS (
      SELECT 1 FROM public.inventory_movements
      WHERE order_id = NEW.id AND reason = 'order_cancelled'
      LIMIT 1
    ) THEN
      RETURN NEW;
    END IF;

    PERFORM set_config('app.skip_stock_sync', 'on', true);

    -- Lock all affected products in deterministic order before mutating
    PERFORM 1
    FROM public.products p
    INNER JOIN (
      SELECT DISTINCT oi2.product_id AS id
      FROM public.order_items oi2
      WHERE oi2.order_id = NEW.id
    ) ids ON p.id = ids.id
    WHERE p.owner_id = NEW.owner_id
    ORDER BY p.id
    FOR UPDATE;

    UPDATE public.products p
    SET stock_quantity = p.stock_quantity + oi.quantity,
        updated_at = NOW()
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.owner_id = NEW.owner_id;

    FOR oi IN
      SELECT product_id, quantity, variant_metadata
      FROM public.order_items
      WHERE order_id = NEW.id
      ORDER BY product_id
    LOOP
      v_size := NULLIF(trim(oi.variant_metadata->>'selected_size'), '');
      v_color := NULLIF(trim(oi.variant_metadata->>'selected_color'), '');

      IF v_size IS NOT NULL OR v_color IS NOT NULL THEN
        UPDATE public.products p
        SET variants = public.adjust_product_variants(p.variants, v_size, v_color, oi.quantity),
            updated_at = NOW()
        WHERE p.id = oi.product_id AND p.owner_id = NEW.owner_id;
      END IF;
    END LOOP;

    INSERT INTO public.inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
    SELECT NEW.id, oi.product_id, NEW.owner_id, oi.quantity, 'order_cancelled'
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id;

    IF NEW.coupon_code IS NOT NULL AND trim(NEW.coupon_code) <> '' THEN
      UPDATE public.marketing_coupons
      SET used_count = GREATEST(0, used_count - 1)
      WHERE owner_id = NEW.owner_id
        AND upper(code) = upper(trim(NEW.coupon_code))
        AND used_count > 0;
    END IF;

    PERFORM set_config('app.skip_stock_sync', 'off', true);
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Inventory restock — lock timeout + skip sync during critical section
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_product_stock(
  p_product_id UUID,
  p_owner_id UUID,
  p_delta INT,
  p_reason TEXT DEFAULT 'restock',
  p_min_stock_level INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INT;
  v_variants JSONB;
  v_scaled_variants JSONB;
  v_new_qty INT;
  v_store_id UUID;
BEGIN
  PERFORM public.apply_merchant_lock_defaults(5000, 12000);

  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_delta IS NULL OR p_delta <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_delta');
  END IF;

  PERFORM set_config('app.skip_stock_sync', 'on', true);

  SELECT stock_quantity, variants, store_id
  INTO v_stock, v_variants, v_store_id
  FROM public.products
  WHERE id = p_product_id AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_store_id IS NOT NULL AND v_store_id NOT IN (SELECT public.auth_user_store_ids()) THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_new_qty := COALESCE(v_stock, 0) + p_delta;
  v_scaled_variants := v_variants;

  IF v_variants IS NOT NULL
     AND jsonb_typeof(v_variants) = 'array'
     AND jsonb_array_length(v_variants) > 0 THEN
    v_scaled_variants := public.scale_variants_to_total(v_variants, v_new_qty);
  END IF;

  UPDATE public.products
  SET stock_quantity = v_new_qty,
      variants = v_scaled_variants,
      min_stock_level = COALESCE(p_min_stock_level, min_stock_level),
      updated_at = NOW()
  WHERE id = p_product_id AND owner_id = p_owner_id;

  PERFORM set_config('app.skip_stock_sync', 'off', true);

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
  VALUES (p_product_id, p_owner_id, p_delta, COALESCE(NULLIF(trim(p_reason), ''), 'restock'));

  RETURN jsonb_build_object('success', true, 'stock_quantity', v_new_qty);
EXCEPTION
  WHEN lock_not_available THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'lock_contention');
  WHEN OTHERS THEN
    PERFORM set_config('app.skip_stock_sync', 'off', true);
    RETURN jsonb_build_object('success', false, 'error', 'restock_failed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Order status RPC — lock timeout, minimal row lock scope
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_merchant_order_status(
  p_order_id UUID,
  p_owner_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_current TEXT;
  v_normalized TEXT := lower(trim(COALESCE(p_status, '')));
BEGIN
  PERFORM public.apply_merchant_lock_defaults(4000, 10000);

  IF v_uid IS NULL OR v_uid <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_order_id IS NULL OR v_normalized = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
  END IF;

  SELECT o.status INTO v_current
  FROM public.orders o
  WHERE o.id = p_order_id AND o.owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_current = v_normalized THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'status', v_current);
  END IF;

  UPDATE public.orders
  SET status = v_normalized, updated_at = NOW()
  WHERE id = p_order_id AND owner_id = p_owner_id;

  RETURN jsonb_build_object(
    'success', true, 'noop', false,
    'previous_status', v_current, 'status', v_normalized
  );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'lock_contention');
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'invalid_status_transition%' THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'status_update_failed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Product patch RPC — lock timeout
-- ---------------------------------------------------------------------------
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
  PERFORM public.apply_merchant_lock_defaults(4000, 10000);

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
    original_price = COALESCE((v_merged->>'original_price')::numeric, p.original_price),
    image_url = COALESCE((v_merged->>'image_url')::text, p.image_url),
    additional_images = COALESCE(v_merged->'additional_images', p.additional_images),
    sizes = COALESCE(v_merged->'sizes', p.sizes),
    colors = COALESCE(v_merged->'colors', p.colors),
    variants = COALESCE(v_merged->'variants', p.variants),
    discount_type = COALESCE((v_merged->>'discount_type')::text, p.discount_type),
    discount_value = COALESCE((v_merged->>'discount_value')::numeric, p.discount_value),
    discount_start_date = COALESCE((v_merged->>'discount_start_date')::timestamptz, p.discount_start_date),
    discount_end_date = COALESCE((v_merged->>'discount_end_date')::timestamptz, p.discount_end_date),
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
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'patch_failed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Lock audit + benchmark RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_lock_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_db RECORD;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT deadlocks, conflicts INTO v_db
  FROM pg_stat_database
  WHERE datname = current_database();

  RETURN jsonb_build_object(
    'success', true,
    'audited_at', now(),
    'phase', '1.3',
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'lock_order_contract', 'advisory(idempotency) -> products(ORDER BY id) -> coupons -> orders -> outbox(SKIP LOCKED)',
    'checkout_inline_side_effects_removed', true,
    'lock_owner_products_ordered', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'lock_owner_products_ordered'),
    'apply_merchant_lock_defaults', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_merchant_lock_defaults'),
    'checkout_lock_timeout_ms', 8000,
    'merchant_rpc_lock_timeout_ms', 4000,
    'database_stats', jsonb_build_object(
      'deadlocks', COALESCE(v_db.deadlocks, 0),
      'conflicts', COALESCE(v_db.conflicts, 0)
    ),
    'waiting_sessions', (
      SELECT COUNT(*)::INT FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
    ),
    'idle_in_transaction', (
      SELECT COUNT(*)::INT FROM pg_stat_activity
      WHERE datname = current_database()
        AND state = 'idle in transaction'
    ),
    'healthy',
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'lock_owner_products_ordered')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_merchant_lock_defaults')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_lock_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_lock_audit() TO service_role;

CREATE OR REPLACE FUNCTION public.platform_lock_benchmark(
  p_owner_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_order_id UUID;
  v_product_id UUID;
  v_results JSONB := '[]'::jsonb;
  v_start TIMESTAMPTZ;
  v_ms NUMERIC;
  v_rec RECORD;
  v_status TEXT;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ss.owner_id INTO v_owner
  FROM public.store_settings ss
  WHERE ss.owner_id IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST LIMIT 1;

  v_owner := COALESCE(p_owner_id, v_owner);
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_owner');
  END IF;

  SELECT o.id, o.status INTO v_order_id, v_status
  FROM public.orders o WHERE o.owner_id = v_owner
  ORDER BY o.created_at DESC LIMIT 1;

  SELECT p.id INTO v_product_id
  FROM public.products p
  WHERE p.owner_id = v_owner AND p.archived_at IS NULL
  ORDER BY p.updated_at DESC NULLS LAST LIMIT 1;

  FOR v_rec IN
    SELECT * FROM (VALUES
      ('order_status_noop_lock'),
      ('product_patch_noop_lock'),
      ('lock_products_ordered_dry')
    ) AS t(name)
  LOOP
    v_start := clock_timestamp();
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);

      IF v_rec.name = 'order_status_noop_lock' AND v_order_id IS NOT NULL THEN
        PERFORM public.update_merchant_order_status(v_order_id, v_owner, v_status);
      ELSIF v_rec.name = 'product_patch_noop_lock' AND v_product_id IS NOT NULL THEN
        PERFORM public.patch_merchant_product(
          v_product_id, v_owner,
          jsonb_build_object('name', (SELECT name FROM public.products WHERE id = v_product_id))
        );
      ELSIF v_rec.name = 'lock_products_ordered_dry' AND v_product_id IS NOT NULL THEN
        PERFORM public.lock_owner_products_ordered(
          v_owner,
          jsonb_build_array(jsonb_build_object('product_id', v_product_id, 'quantity', 1))
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', v_rec.name, 'error', SQLERRM
      ));
      CONTINUE;
    END;

    v_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::numeric;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'name', v_rec.name,
      'lock_duration_ms', ROUND(v_ms, 3),
      'owner_id', v_owner
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'benchmark_at', now(),
    'phase', '1.3',
    'owner_id', v_owner,
    'paths', v_results,
    'audit', public.platform_lock_audit()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_lock_benchmark(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_lock_benchmark(UUID) TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (73, 'lock_opt phase 1.3: ordered product locks, checkout critical section shrink, lock audit')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
