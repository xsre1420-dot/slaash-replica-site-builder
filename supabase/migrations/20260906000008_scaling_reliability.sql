-- Scaling reliability: pressure audit, checkout owner-scoped limits.

-- ---------------------------------------------------------------------------
-- 1) Unified scaling pressure audit (service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_scaling_pressure_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool JSONB;
  v_workers JSONB;
  v_analytics_pending INT := 0;
  v_side_pending INT := 0;
  v_webhook_pending INT := 0;
  v_rate_limit_rows INT := 0;
  v_checkout_keys INT := 0;
  v_connections JSONB;
  v_critical BOOLEAN := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  IF public._platform_fn_exists('platform_connection_pool_recommendations') THEN
    v_pool := public.platform_connection_pool_recommendations();
  ELSE
    v_pool := '{}'::jsonb;
  END IF;

  IF public._platform_fn_exists('platform_worker_health_audit') THEN
    v_workers := public.platform_worker_health_audit();
  ELSE
    v_workers := '{}'::jsonb;
  END IF;

  SELECT COUNT(*)::INT INTO v_analytics_pending
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

  SELECT COUNT(*)::INT INTO v_side_pending
  FROM public.order_side_effects_outbox
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

  SELECT COUNT(*)::INT INTO v_webhook_pending
  FROM public.order_webhook_outbox WHERE status = 'pending';

  SELECT COUNT(*)::INT,
         COUNT(*) FILTER (WHERE rate_key LIKE 'checkout:%')::INT
  INTO v_rate_limit_rows, v_checkout_keys
  FROM public.rpc_rate_limits;

  BEGIN
    SELECT jsonb_build_object(
      'active', COUNT(*) FILTER (WHERE state = 'active'),
      'waiting', COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL AND state = 'active'),
      'total', COUNT(*)
    ) INTO v_connections
    FROM pg_stat_activity
    WHERE datname = current_database();
  EXCEPTION WHEN OTHERS THEN
    v_connections := jsonb_build_object('error', LEFT(SQLERRM, 120));
  END;

  v_critical :=
    v_analytics_pending >= 2000
    OR v_side_pending >= 500
    OR v_webhook_pending >= 200
    OR COALESCE((v_workers->>'overall')::text, 'ok') = 'critical'
    OR COALESCE((v_connections->>'waiting')::int, 0) > 10;

  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'critical', v_critical,
    'connection_pool', v_pool,
    'pg_connections', v_connections,
    'queues', jsonb_build_object(
      'analytics_pending', v_analytics_pending,
      'side_effects_pending', v_side_pending,
      'webhook_pending', v_webhook_pending
    ),
    'rate_limits', jsonb_build_object(
      'tracked_keys', v_rate_limit_rows,
      'checkout_keys', v_checkout_keys
    ),
    'workers', v_workers,
    'recommendations',
      CASE WHEN v_critical THEN jsonb_build_array(
        'Enable Supavisor transaction pooling (x-connection-mode: pooler)',
        'Route storefront reads through get-store-products edge + KV cache',
        'Verify edge cron workers are active',
        'Run prune_rpc_rate_limits if checkout_keys is high'
      ) ELSE '[]'::jsonb END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_scaling_pressure_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_scaling_pressure_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Checkout — owner-scoped rate limit AFTER idempotent duplicate short-circuit
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
  v_payment_method TEXT;
  v_payment_status TEXT;
  v_snap JSONB;
  v_snap_products JSONB;
  v_row JSONB;
BEGIN
  SET LOCAL search_path = public;
  PERFORM public.apply_merchant_lock_defaults(8000, 20000);

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'idempotency_required');
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

  PERFORM pg_advisory_xact_lock(hashtext(v_effective_owner::text || ':' || trim(p_idempotency_key)));

  v_recovery := public.checkout_resolve_duplicate_order(v_effective_owner, p_idempotency_key, NULL);
  IF v_recovery IS NOT NULL THEN
    RETURN v_recovery;
  END IF;

  -- Owner-scoped limit (120/min) — after idempotent replay short-circuit; not IP-bound.
  IF NOT public.check_rpc_rate_limit('checkout:owner:' || v_effective_owner::text, 120, 60) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
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

  v_snap := public.checkout_lock_product_snapshots(v_effective_owner, p_items);
  v_snap_products := COALESCE(v_snap->'products', '{}'::jsonb);
  v_updated_count := COALESCE((v_snap->>'locked_count')::INT, 0);

  IF v_updated_count <> v_item_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_line_qty := (v_item->>'quantity')::INT;
    IF v_product_id IS NULL OR v_line_qty IS NULL OR v_line_qty <= 0 THEN CONTINUE; END IF;

    v_row := v_snap_products -> v_product_id::text;
    IF v_row IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');

    v_stock := v_row->>'stock_quantity';
    v_variants := COALESCE(v_row->'variants', '[]'::jsonb);
    v_product_name := v_row->>'name';

    v_available := public.product_checkout_available_qty(
      CASE WHEN v_stock IS NULL OR (v_stock)::INT = 2147483647 THEN NULL ELSE (v_stock)::INT END,
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
    v_row := v_snap_products -> v_product_id::text;
    v_db_price := COALESCE((v_row->>'unit_price')::DECIMAL, 0);
    v_subtotal := v_subtotal + v_db_price * v_qty;
  END LOOP;

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
    total_amount, total_price, status, notes, customer_governorate, payment_method, payment_status,
    coupon_code, discount_amount, delivery_fee, delivery_status, created_at, updated_at
  ) VALUES (
    v_order_id, v_effective_owner, trim(p_idempotency_key),
    trim(p_customer_name), trim(p_customer_phone), trim(p_customer_address),
    v_computed_total, v_computed_total, 'pending', NULLIF(trim(p_notes), ''),
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
  SELECT
    v_order_id,
    v_effective_owner,
    (item->>'product_id')::UUID,
    snap.row->>'name',
    COALESCE((snap.row->>'unit_price')::DECIMAL, 0),
    (item->>'quantity')::INT,
    COALESCE((snap.row->>'unit_price')::DECIMAL, 0) * (item->>'quantity')::INT,
    jsonb_build_object(
      'selected_size', NULLIF(trim(item->>'selected_size'), ''),
      'selected_color', NULLIF(trim(item->>'selected_color'), '')
    ),
    NOW()
  FROM jsonb_array_elements(p_items) AS t(item)
  CROSS JOIN LATERAL (
    SELECT v_snap_products -> (item->>'product_id') AS row
  ) snap
  WHERE (item->>'quantity')::INT > 0
    AND snap.row IS NOT NULL;

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
  WHERE p.id = agg.product_id
    AND p.owner_id = v_effective_owner
    AND public.checkout_product_stock_deductible(p, agg.qty);

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
    v_row := v_snap_products -> v_product_id::text;
    v_running_variants := COALESCE(v_row->'variants', '[]'::jsonb);

    IF v_running_variants IS NULL
       OR jsonb_typeof(v_running_variants) <> 'array'
       OR jsonb_array_length(v_running_variants) = 0 THEN
      CONTINUE;
    END IF;

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

INSERT INTO public.platform_schema_version (version, notes)
VALUES (113, 'scaling: pressure audit, owner-scoped checkout rate limit')
ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes, applied_at = NOW();
