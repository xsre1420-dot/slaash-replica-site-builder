-- v66: Enterprise write-path optimization — checkout fast path, deferred side effects, WAL reduction
-- Defers non-critical order triggers (stats, shipment, webhook, customer) to background batch processor.
-- Inlines payment row during checkout; drops redundant audit trigger; reduces stock UPDATE WAL.

-- ---------------------------------------------------------------------------
-- 1) Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_checkout_fast_path()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(current_setting('app.checkout_fast_path', true), '') = 'on';
$$;

-- ---------------------------------------------------------------------------
-- 2) Order side-effects outbox (stats, shipment, webhook, customer — async)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_side_effects_outbox (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  effects_pending TEXT[] NOT NULL DEFAULT ARRAY['stats', 'shipment', 'webhook', 'customer'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_side_effects_outbox_order_pending
  ON public.order_side_effects_outbox (order_id)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_side_effects_outbox_pending
  ON public.order_side_effects_outbox (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.order_side_effects_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view order side effects outbox" ON public.order_side_effects_outbox;
CREATE POLICY "Owners view order side effects outbox"
  ON public.order_side_effects_outbox FOR SELECT
  USING (owner_id = auth.uid());

COMMENT ON TABLE public.order_side_effects_outbox IS
  'Deferred checkout side effects — processed by process_order_side_effects_batch';

-- ---------------------------------------------------------------------------
-- 3) Batch processor — idempotent replay-safe side effects
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
          v_order.id,
          v_order.owner_id,
          'pending',
          COALESCE(v_order.delivery_fee, 0),
          v_order.customer_name,
          v_order.customer_phone,
          v_order.customer_address,
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
          v_order.owner_id,
          v_order.store_id,
          v_order.id,
          'order.created',
          jsonb_build_object(
            'order_id', v_order.id,
            'owner_id', v_order.owner_id,
            'store_id', v_order.store_id,
            'status', v_order.status,
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
          v_order.owner_id,
          v_order.customer_phone,
          v_order.customer_name,
          v_order.created_at,
          v_order.created_at,
          1,
          v_order.total_amount
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

REVOKE ALL ON FUNCTION public.process_order_side_effects_batch(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_order_side_effects_batch(INT) TO service_role;

-- One payment ledger row per order (enables ON CONFLICT + idempotent checkout inline insert)
DELETE FROM public.payment_transactions a
USING public.payment_transactions b
WHERE a.order_id = b.order_id AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_order_unique
  ON public.payment_transactions (order_id);

COMMENT ON INDEX public.idx_payment_transactions_order_unique IS
  'Write path v66: one payment transaction per order — shorter checkout critical section';

-- ---------------------------------------------------------------------------
-- 4) Triggers — respect checkout fast path (defer to outbox)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_orders_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stat_date DATE;
  v_revenue_delta NUMERIC;
  v_completed_delta INT;
BEGIN
  IF public.is_checkout_fast_path() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.total_amount IS NOT DISTINCT FROM NEW.total_amount
     AND OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
    IF COALESCE(NEW.status, '') = 'completed' AND COALESCE(NEW.payment_status, '') = 'refunded' THEN
      v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
      UPDATE public.store_daily_stats
      SET completed_revenue = GREATEST(0, completed_revenue - COALESCE(NEW.total_amount, 0)),
          completed_order_count = GREATEST(0, completed_order_count - 1),
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.upsert_store_daily_order_stats(
      OLD.owner_id,
      (OLD.created_at AT TIME ZONE 'UTC')::DATE,
      OLD.status,
      COALESCE(OLD.total_amount, 0),
      -1
    );
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND COALESCE(OLD.total_amount, 0) IS DISTINCT FROM COALESCE(NEW.total_amount, 0) THEN
    v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
    v_revenue_delta := COALESCE(NEW.total_amount, 0) - COALESCE(OLD.total_amount, 0);
    UPDATE public.store_daily_stats
    SET completed_revenue = GREATEST(0, completed_revenue + v_revenue_delta),
        updated_at = NOW()
    WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND COALESCE(OLD.payment_status, '') IS DISTINCT FROM COALESCE(NEW.payment_status, '') THEN
    v_stat_date := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
    v_revenue_delta := COALESCE(NEW.total_amount, 0);
    v_completed_delta := 1;
    IF COALESCE(OLD.payment_status, '') <> 'refunded' AND COALESCE(NEW.payment_status, '') = 'refunded' THEN
      UPDATE public.store_daily_stats
      SET completed_revenue = GREATEST(0, completed_revenue - v_revenue_delta),
          completed_order_count = GREATEST(0, completed_order_count - v_completed_delta),
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    ELSIF COALESCE(OLD.payment_status, '') = 'refunded' AND COALESCE(NEW.payment_status, '') <> 'refunded' THEN
      UPDATE public.store_daily_stats
      SET completed_revenue = completed_revenue + v_revenue_delta,
          completed_order_count = completed_order_count + v_completed_delta,
          updated_at = NOW()
      WHERE owner_id = NEW.owner_id AND stat_date = v_stat_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_shipment_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipment_id UUID;
BEGIN
  IF public.is_checkout_fast_path() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.shipments WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shipments (
    order_id, owner_id, status, delivery_fee,
    recipient_name, recipient_phone, delivery_address, governorate
  ) VALUES (
    NEW.id, NEW.owner_id, 'pending', COALESCE(NEW.delivery_fee, 0),
    NEW.customer_name, NEW.customer_phone, NEW.customer_address, NEW.customer_governorate
  )
  RETURNING id INTO v_shipment_id;

  INSERT INTO public.shipment_tracking_events (shipment_id, status, note)
  VALUES (v_shipment_id, 'pending', 'تم إنشاء الشحنة');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_order_webhook_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_checkout_fast_path() THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.order_webhook_outbox (
    owner_id, store_id, order_id, event_type, payload
  ) VALUES (
    NEW.owner_id, NEW.store_id, NEW.id, 'order.created',
    jsonb_build_object(
      'order_id', NEW.id, 'owner_id', NEW.owner_id, 'store_id', NEW.store_id,
      'status', NEW.status, 'total_amount', NEW.total_amount,
      'customer_name', NEW.customer_name, 'customer_phone', NEW.customer_phone,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_checkout_fast_path() AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.customers (owner_id, phone, name, first_order_date, last_order_date, total_orders, total_spent)
    VALUES (NEW.owner_id, NEW.customer_phone, NEW.customer_name, NEW.created_at, NEW.created_at, 1, NEW.total_amount)
    ON CONFLICT (owner_id, phone) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, customers.name),
      last_order_date = EXCLUDED.last_order_date,
      total_orders = customers.total_orders + 1,
      total_spent = customers.total_spent + EXCLUDED.total_spent,
      updated_at = NOW();
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    UPDATE public.customers
    SET total_orders = GREATEST(total_orders - 1, 0),
        total_spent = GREATEST(total_spent - OLD.total_amount, 0),
        updated_at = NOW()
    WHERE owner_id = OLD.owner_id AND phone = OLD.customer_phone;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_payment_transaction_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_provider TEXT;
BEGIN
  IF public.is_checkout_fast_path() THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_payment_method_allowed(NEW.owner_id, NEW.payment_method) THEN
    RAISE EXCEPTION 'payment_method_not_allowed: %', NEW.payment_method;
  END IF;

  IF EXISTS (SELECT 1 FROM public.payment_transactions WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_status := 'pending';
  v_provider := 'internal';

  IF NEW.payment_method = 'cash_on_delivery' THEN
    v_status := 'pending';
  ELSIF NEW.payment_method = 'digital_wallet' THEN
    v_status := 'pending';
  ELSE
    v_status := 'failed';
  END IF;

  INSERT INTO public.payment_transactions (
    order_id, owner_id, amount, payment_method, status, provider, idempotency_key
  ) VALUES (
    NEW.id, NEW.owner_id, NEW.total_amount,
    COALESCE(NEW.payment_method, 'cash_on_delivery'),
    v_status, v_provider, NEW.idempotency_key
  )
  ON CONFLICT DO NOTHING;

  NEW.payment_status := CASE
    WHEN NEW.payment_method = 'cash_on_delivery' THEN 'pending_collection'
    WHEN NEW.payment_method = 'digital_wallet' THEN 'awaiting_gateway'
    ELSE 'failed'
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_delivery_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_status IS NULL THEN
    NEW.delivery_status := 'pending';
  END IF;

  IF NEW.delivery_fee IS NOT NULL AND NEW.delivery_fee > 0 THEN
    RETURN NEW;
  END IF;

  IF public.is_checkout_fast_path() AND NEW.delivery_fee IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_fee IS NULL OR NEW.delivery_fee = 0 THEN
    NEW.delivery_fee := public.calculate_delivery_fee(NEW.owner_id, NEW.customer_governorate);
  END IF;

  RETURN NEW;
END;
$$;

-- Redundant audit row per order — order row + webhook outbox suffice
DROP TRIGGER IF EXISTS order_creation_log_trigger ON public.orders;

-- ---------------------------------------------------------------------------
-- 5) Checkout RPC — fast path, inline payment, minimal stock WAL, defer side effects
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

    UPDATE public.marketing_coupons
    SET used_count = used_count + 1
    WHERE id = v_coupon.id;
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
  ON CONFLICT DO NOTHING;

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
-- 6) Coupon used_count — skip updated_at touch (WAL reduction)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_marketing_coupons_skip_noop_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.used_count IS NOT DISTINCT FROM NEW.used_count
     AND to_jsonb(OLD) - 'updated_at' = to_jsonb(NEW) - 'updated_at' THEN
    RETURN NEW;
  END IF;
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketing_coupons_updated_at ON public.marketing_coupons;
CREATE TRIGGER trg_marketing_coupons_updated_at
  BEFORE UPDATE ON public.marketing_coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_marketing_coupons_skip_noop_updated_at();

-- ---------------------------------------------------------------------------
-- 7) Write-path audit RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_write_path_audit()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'audited_at', now(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'checkout_fast_path', EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'is_checkout_fast_path'
    ),
    'order_side_effects_outbox', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'order_side_effects_outbox'
    ),
    'order_creation_log_trigger', EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'orders' AND t.tgname = 'order_creation_log_trigger'
    ),
    'pending_side_effects', (
      SELECT COUNT(*)::INT FROM public.order_side_effects_outbox WHERE processed_at IS NULL
    ),
    'pending_analytics_events', (
      SELECT COUNT(*)::INT FROM public.analytics_event_outbox WHERE processed_at IS NULL
    ),
    'pending_webhooks', (
      SELECT COUNT(*)::INT FROM public.order_webhook_outbox WHERE status = 'pending'
    ),
    'healthy',
      NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = 'orders' AND t.tgname = 'order_creation_log_trigger'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.platform_write_path_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_write_path_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Background jobs monitor — include order side-effects queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_background_jobs_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_analytics_pending INT := 0;
  v_analytics_oldest INT := 0;
  v_webhook_pending INT := 0;
  v_webhook_processing INT := 0;
  v_webhook_failed INT := 0;
  v_webhook_oldest INT := 0;
  v_side_effects_pending INT := 0;
  v_side_effects_oldest INT := 0;
  v_status TEXT := 'ok';
BEGIN
  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT, 0)
  INTO v_analytics_pending, v_analytics_oldest
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL;

  SELECT COUNT(*) FILTER (WHERE status = 'pending')::INT,
         COUNT(*) FILTER (WHERE status = 'processing')::INT,
         COUNT(*) FILTER (WHERE status = 'failed')::INT,
         COALESCE(
           EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'pending')))::INT,
           0
         )
  INTO v_webhook_pending, v_webhook_processing, v_webhook_failed, v_webhook_oldest
  FROM public.order_webhook_outbox;

  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT, 0)
  INTO v_side_effects_pending, v_side_effects_oldest
  FROM public.order_side_effects_outbox
  WHERE processed_at IS NULL;

  IF v_analytics_pending >= 5000 OR v_webhook_pending >= 500 OR v_webhook_failed >= 100
     OR v_side_effects_pending >= 1000 THEN
    v_status := 'critical';
  ELSIF v_analytics_pending >= 500 OR v_webhook_pending >= 100
        OR v_side_effects_pending >= 200
        OR v_analytics_oldest > 600 OR v_webhook_oldest > 600 OR v_side_effects_oldest > 300 THEN
    v_status := 'degraded';
  ELSIF v_analytics_pending >= 100 OR v_webhook_pending >= 25 OR v_side_effects_pending >= 50
        OR v_analytics_oldest > 180 OR v_webhook_oldest > 180 OR v_side_effects_oldest > 120 THEN
    v_status := 'warn';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'analytics', jsonb_build_object(
      'pending', v_analytics_pending,
      'oldest_pending_seconds', v_analytics_oldest,
      'processor', 'process_analytics_event_buffer'
    ),
    'order_webhooks', jsonb_build_object(
      'pending', v_webhook_pending,
      'processing', v_webhook_processing,
      'failed_dead_letter', v_webhook_failed,
      'oldest_pending_seconds', v_webhook_oldest,
      'processor', 'claim_order_webhook_outbox_batch + edge worker'
    ),
    'order_side_effects', jsonb_build_object(
      'pending', v_side_effects_pending,
      'oldest_pending_seconds', v_side_effects_oldest,
      'processor', 'process_order_side_effects_batch'
    ),
    'recommendations',
      CASE
        WHEN v_side_effects_pending > 0 AND v_side_effects_oldest > 120
          THEN jsonb_build_array('run process_order_side_effects_batch')
        WHEN v_webhook_processing > 10 THEN jsonb_build_array('stale_processing_rows — check edge worker')
        WHEN v_webhook_pending > 0 AND v_webhook_oldest > 120
          THEN jsonb_build_array('invoke process-order-webhook-outbox edge function')
        WHEN v_analytics_pending > 0 AND v_analytics_oldest > 120
          THEN jsonb_build_array('run process_analytics_event_buffer')
        ELSE '[]'::jsonb
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_background_jobs_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_background_jobs_status() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9) Refresh planner statistics
-- ---------------------------------------------------------------------------
ANALYZE public.orders;
ANALYZE public.products;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (66, 'write_path: checkout fast path, deferred order side effects, WAL reduction')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
