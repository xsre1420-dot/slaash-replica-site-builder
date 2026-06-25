-- v68: Connection pool & database resource optimization — audit RPCs, RPC timeouts, fewer round-trips

-- ---------------------------------------------------------------------------
-- 1) get_store_products_page — include cache_version (eliminates extra edge RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_products_page(
  p_slug TEXT,
  p_limit INT DEFAULT 24,
  p_cursor TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_limit INT;
  v_cursor_ts TIMESTAMPTZ;
  v_cursor_id UUID;
  v_products JSONB;
  v_next_cursor TEXT;
  v_has_more BOOLEAN;
  v_last_created TIMESTAMPTZ;
  v_last_id UUID;
  v_cache_version BIGINT;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object(
      'products', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false, 'cache_version', 1
    );
  END IF;

  v_owner_id := public._resolve_store_owner_by_slug(p_slug);
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'products', '[]'::jsonb, 'next_cursor', NULL, 'has_more', false, 'cache_version', 1
    );
  END IF;

  SELECT COALESCE(ss.storefront_cache_version, 1)
  INTO v_cache_version
  FROM public.store_settings ss
  WHERE ss.owner_id = v_owner_id
  LIMIT 1;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);

  IF p_cursor IS NOT NULL AND trim(p_cursor) <> '' AND position('|' IN p_cursor) > 0 THEN
    v_cursor_ts := split_part(p_cursor, '|', 1)::timestamptz;
    v_cursor_id := split_part(p_cursor, '|', 2)::uuid;
  END IF;

  WITH ranked AS (
    SELECT
      p.created_at,
      p.id,
      public.storefront_product_grid_json(p) AS pj,
      ROW_NUMBER() OVER (ORDER BY p.created_at DESC, p.id DESC) AS rn
    FROM public.products p
    WHERE p.owner_id = v_owner_id
      AND p.archived_at IS NULL
      AND COALESCE(p.is_active, true) = true
      AND (p_category IS NULL OR trim(p_category) = '' OR p.category = trim(p_category))
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR p.name ILIKE '%' || trim(p_search) || '%'
        OR p.description ILIKE '%' || trim(p_search) || '%'
      )
      AND (
        v_cursor_ts IS NULL
        OR (p.created_at, p.id) < (v_cursor_ts, v_cursor_id)
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT v_limit + 1
  )
  SELECT
    COALESCE((SELECT jsonb_agg(r.pj ORDER BY r.created_at DESC, r.id DESC) FROM ranked r WHERE r.rn <= v_limit), '[]'::jsonb),
    (SELECT COUNT(*) FROM ranked) > v_limit,
    (SELECT r.created_at FROM ranked r WHERE r.rn = v_limit),
    (SELECT r.id FROM ranked r WHERE r.rn = v_limit)
  INTO v_products, v_has_more, v_last_created, v_last_id;

  IF v_has_more AND v_last_created IS NOT NULL AND v_last_id IS NOT NULL THEN
    v_next_cursor := v_last_created::text || '|' || v_last_id::text;
  ELSE
    v_next_cursor := NULL;
    v_has_more := false;
  END IF;

  RETURN jsonb_build_object(
    'products', COALESCE(v_products, '[]'::jsonb),
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false),
    'cache_version', COALESCE(v_cache_version, 1)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Batch processors — bounded statement timeout (release connections faster)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_order_side_effects_batch(p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_rec RECORD;
  v_order RECORD;
  v_processed INT := 0;
  v_shipment_id UUID;
  v_remaining TEXT[];
BEGIN
  PERFORM set_config('statement_timeout', '45000', true);
  PERFORM set_config('lock_timeout', '5000', true);

  FOR v_rec IN
    SELECT o.*
    FROM public.order_side_effects_outbox o
    WHERE o.processed_at IS NULL
    ORDER BY o.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT * INTO v_order
      FROM public.orders
      WHERE id = v_rec.order_id AND owner_id = v_rec.owner_id;

      IF NOT FOUND THEN
        UPDATE public.order_side_effects_outbox
        SET processed_at = NOW(), last_error = 'order_not_found'
        WHERE id = v_rec.id;
        CONTINUE;
      END IF;

      v_remaining := v_rec.effects_pending;

      IF 'stats' = ANY (v_remaining) THEN
        PERFORM public.upsert_store_daily_order_stats(
          v_order.owner_id,
          (v_order.created_at AT TIME ZONE 'UTC')::DATE,
          COALESCE(v_order.status, 'pending'),
          COALESCE(v_order.total_amount, 0),
          1
        );
        v_remaining := array_remove(v_remaining, 'stats');
      END IF;

      IF 'shipment' = ANY (v_remaining) AND NOT EXISTS (
        SELECT 1 FROM public.shipments s WHERE s.order_id = v_order.id
      ) THEN
        INSERT INTO public.shipments (
          order_id, owner_id, status, delivery_fee,
          recipient_name, recipient_phone, delivery_address, governorate
        ) VALUES (
          v_order.id, v_order.owner_id, 'pending', COALESCE(v_order.delivery_fee, 0),
          v_order.customer_name, v_order.customer_phone, v_order.customer_address,
          v_order.customer_governorate
        )
        RETURNING id INTO v_shipment_id;

        INSERT INTO public.shipment_tracking_events (shipment_id, status, note)
        VALUES (v_shipment_id, 'pending', 'تم إنشاء الشحنة');
        v_remaining := array_remove(v_remaining, 'shipment');
      ELSIF 'shipment' = ANY (v_remaining) THEN
        v_remaining := array_remove(v_remaining, 'shipment');
      END IF;

      IF 'webhook' = ANY (v_remaining) AND NOT EXISTS (
        SELECT 1 FROM public.order_webhook_outbox w
        WHERE w.order_id = v_order.id AND w.event_type = 'order.created'
      ) THEN
        INSERT INTO public.order_webhook_outbox (
          owner_id, store_id, order_id, event_type, payload
        ) VALUES (
          v_order.owner_id, v_order.store_id, v_order.id, 'order.created',
          jsonb_build_object(
            'order_id', v_order.id, 'owner_id', v_order.owner_id,
            'store_id', v_order.store_id, 'status', v_order.status,
            'total_amount', v_order.total_amount,
            'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone,
            'created_at', v_order.created_at
          )
        );
        v_remaining := array_remove(v_remaining, 'webhook');
      ELSIF 'webhook' = ANY (v_remaining) THEN
        v_remaining := array_remove(v_remaining, 'webhook');
      END IF;

      IF 'customer' = ANY (v_remaining) THEN
        INSERT INTO public.customers (
          owner_id, phone, name, first_order_date, last_order_date, total_orders, total_spent
        ) VALUES (
          v_order.owner_id, v_order.customer_phone, v_order.customer_name,
          v_order.created_at, v_order.created_at, 1, v_order.total_amount
        )
        ON CONFLICT (owner_id, phone) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, customers.name),
          last_order_date = EXCLUDED.last_order_date,
          total_orders = customers.total_orders + 1,
          total_spent = customers.total_spent + EXCLUDED.total_spent,
          updated_at = NOW();
        v_remaining := array_remove(v_remaining, 'customer');
      END IF;

      UPDATE public.order_side_effects_outbox
      SET effects_pending = v_remaining,
          processed_at = CASE WHEN COALESCE(array_length(v_remaining, 1), 0) = 0 THEN NOW() ELSE NULL END,
          last_error = NULL
      WHERE id = v_rec.id;

      IF COALESCE(array_length(v_remaining, 1), 0) = 0 THEN
        v_processed := v_processed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.order_side_effects_outbox
      SET last_error = LEFT(SQLERRM, 500)
      WHERE id = v_rec.id;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'pending', (SELECT COUNT(*)::INT FROM public.order_side_effects_outbox WHERE processed_at IS NULL)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Checkout — bounded timeouts (prevent idle-in-transaction connection hogging)
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
  v_line_qty INT;
  v_effective_owner UUID;
  v_recovery JSONB;
  v_ip TEXT;
  v_payment_method TEXT;
  v_payment_status TEXT;
  v_side_pending INT;
BEGIN
  SET LOCAL search_path = public;
  PERFORM set_config('statement_timeout', '20000', true);
  PERFORM set_config('lock_timeout', '8000', true);

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

  PERFORM pg_advisory_xact_lock(hashtext(v_effective_owner::text || ':' || trim(p_idempotency_key)));

  v_recovery := public.checkout_resolve_duplicate_order(v_effective_owner, p_idempotency_key, NULL);
  IF v_recovery IS NOT NULL THEN
    RETURN v_recovery;
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

  PERFORM 1
  FROM public.products p
  INNER JOIN (
    SELECT DISTINCT (item->>'product_id')::UUID AS id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'quantity')::INT > 0
  ) ids ON p.id = ids.id
  WHERE p.owner_id = v_effective_owner
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL
  ORDER BY p.id
  FOR UPDATE;

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
    WHERE id = v_product_id AND owner_id = v_effective_owner
      AND COALESCE(is_active, true) = true AND archived_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;
    v_subtotal := v_subtotal + v_db_price * v_qty;
  END LOOP;

  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
    FROM public.marketing_coupons
    WHERE owner_id = v_effective_owner AND upper(code) = upper(trim(p_coupon_code))
      AND is_active = true AND start_date <= NOW()
      AND (end_date IS NULL OR end_date >= NOW())
      AND (usage_limit IS NULL OR used_count < usage_limit)
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

  SELECT COUNT(*)::INT INTO v_side_pending
  FROM public.order_side_effects_outbox WHERE processed_at IS NULL;

  IF v_side_pending >= 25 THEN
    PERFORM public.process_order_side_effects_batch(50);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_computed_total,
    'discount_amount', v_coupon_discount,
    'delivery_fee', v_delivery_fee,
    'side_effects_deferred', true
  );

EXCEPTION WHEN OTHERS THEN
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
-- 4) platform_database_resource_audit — connection + wait event snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_database_resource_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_conn INT;
  v_result JSONB;
BEGIN
  SELECT setting::INT INTO v_max_conn
  FROM pg_settings WHERE name = 'max_connections';

  SELECT jsonb_build_object(
    'audited_at', now(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'max_connections', v_max_conn,
    'connections', (
      SELECT jsonb_build_object(
        'total', COUNT(*)::INT,
        'active', COUNT(*) FILTER (WHERE state = 'active')::INT,
        'idle', COUNT(*) FILTER (WHERE state = 'idle')::INT,
        'idle_in_transaction', COUNT(*) FILTER (WHERE state = 'idle in transaction')::INT,
        'waiting', COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL AND wait_event_type <> 'Client')::INT
      )
      FROM pg_stat_activity
      WHERE datname = current_database()
    ),
    'by_application', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.connections DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(application_name, 'unknown') AS application_name,
               COUNT(*)::INT AS connections,
               COUNT(*) FILTER (WHERE state = 'idle in transaction')::INT AS idle_in_tx
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY 1
        ORDER BY COUNT(*) DESC
        LIMIT 15
      ) t
    ),
    'long_transactions', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT pid, state, application_name,
               EXTRACT(EPOCH FROM (NOW() - xact_start))::INT AS xact_seconds,
               LEFT(query, 120) AS query_preview
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND xact_start IS NOT NULL
          AND NOW() - xact_start > INTERVAL '5 seconds'
        ORDER BY xact_start
        LIMIT 10
      ) t
    ),
    'lock_waits', (
      SELECT COUNT(*)::INT
      FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    ),
    'temp_files', (
      SELECT COALESCE(SUM(temp_files), 0)::BIGINT FROM pg_stat_database WHERE datname = current_database()
    ),
    'outbox_backlog', jsonb_build_object(
      'analytics', (SELECT COUNT(*)::INT FROM public.analytics_event_outbox WHERE processed_at IS NULL),
      'order_side_effects', (SELECT COUNT(*)::INT FROM public.order_side_effects_outbox WHERE processed_at IS NULL),
      'webhooks', (SELECT COUNT(*)::INT FROM public.order_webhook_outbox WHERE status = 'pending')
    ),
    'healthy',
      (SELECT COUNT(*) FROM pg_stat_activity
       WHERE datname = current_database() AND state = 'idle in transaction') < 5
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_database_resource_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_database_resource_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (68, 'connection_pool: resource audit RPC, checkout timeouts, products page cache_version')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
