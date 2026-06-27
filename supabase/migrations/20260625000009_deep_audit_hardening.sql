-- Deep audit hardening v19: tenant security, checkout idempotency, orders list perf, indexes

-- ---------------------------------------------------------------------------
-- 1) Lock internal stats rollup RPC (trigger-only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_store_daily_order_stats(
  p_owner_id UUID,
  p_stat_date DATE,
  p_status TEXT,
  p_total NUMERIC,
  p_delta INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'upsert_store_daily_order_stats is internal only';
  END IF;

  INSERT INTO public.store_daily_stats (
    owner_id, stat_date, order_count, completed_order_count, cancelled_order_count,
    gross_revenue, completed_revenue
  )
  VALUES (
    p_owner_id,
    p_stat_date,
    GREATEST(p_delta, 0),
    CASE WHEN p_status = 'completed' THEN GREATEST(p_delta, 0) ELSE 0 END,
    CASE WHEN p_status = 'cancelled' THEN GREATEST(p_delta, 0) ELSE 0 END,
    CASE WHEN p_status <> 'cancelled' THEN GREATEST(p_total, 0) * GREATEST(p_delta, 0) ELSE 0 END,
    CASE WHEN p_status = 'completed' THEN GREATEST(p_total, 0) * GREATEST(p_delta, 0) ELSE 0 END
  )
  ON CONFLICT (owner_id, stat_date) DO UPDATE SET
    order_count = store_daily_stats.order_count + EXCLUDED.order_count,
    completed_order_count = store_daily_stats.completed_order_count + EXCLUDED.completed_order_count,
    cancelled_order_count = store_daily_stats.cancelled_order_count + EXCLUDED.cancelled_order_count,
    gross_revenue = store_daily_stats.gross_revenue + EXCLUDED.gross_revenue,
    completed_revenue = store_daily_stats.completed_revenue + EXCLUDED.completed_revenue,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_store_daily_order_stats(UUID, DATE, TEXT, NUMERIC, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_store_daily_order_stats(UUID, DATE, TEXT, NUMERIC, INT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Storage + RLS cleanup (idempotent)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "product_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "Categories viewable for public stores" ON public.categories;
DROP POLICY IF EXISTS "Owners view order items" ON public.order_items;
DROP POLICY IF EXISTS "Owners manage order items" ON public.order_items;

-- ---------------------------------------------------------------------------
-- 3) Checkout idempotency recovery helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_resolve_duplicate_order(
  p_owner_id UUID,
  p_idempotency_key TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_total NUMERIC;
BEGIN
  IF p_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT o.id, o.total_amount
    INTO v_id, v_total
    FROM public.orders o
    WHERE o.owner_id = p_owner_id
      AND o.idempotency_key = trim(p_idempotency_key)
    LIMIT 1;
  ELSIF p_order_id IS NOT NULL THEN
    SELECT o.id, o.total_amount
    INTO v_id, v_total
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.owner_id = p_owner_id
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_id,
    'total_amount', COALESCE(v_total, 0),
    'idempotent', true,
    'message', 'Order already exists'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_resolve_duplicate_order(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_resolve_duplicate_order(UUID, TEXT, UUID) TO anon, authenticated;

-- Patch checkout RPC: idempotent total + unique-violation recovery
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
  v_existing_order UUID;
  v_existing_total DECIMAL;
  v_effective_owner UUID;
  v_recovery JSONB;
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
    v_recovery := public.checkout_resolve_duplicate_order(v_effective_owner, p_idempotency_key, NULL);
    IF v_recovery IS NOT NULL THEN
      RETURN v_recovery;
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
  WHERE p.owner_id = v_effective_owner
    AND COALESCE(p.is_active, true) = true
    AND p.archived_at IS NULL
  ORDER BY p.id
  FOR UPDATE;

  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_line_qty := (v_item->>'quantity')::INT;

    IF v_product_id IS NULL OR v_line_qty IS NULL OR v_line_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');

    SELECT
      COALESCE(stock_quantity, 2147483647),
      variants,
      name
    INTO v_stock, v_variants, v_product_name
    FROM products
    WHERE id = v_product_id
      AND owner_id = v_effective_owner
      AND COALESCE(is_active, true) = true
      AND archived_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_available := public.product_checkout_available_qty(
      CASE WHEN v_stock = 2147483647 THEN NULL ELSE v_stock END,
      v_variants,
      v_selected_size,
      v_selected_color
    );

    IF v_available < v_line_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'insufficient stock',
        'product_id', v_product_id,
        'product_name', v_product_name,
        'available', v_available,
        'requested', v_line_qty
      );
    END IF;
  END LOOP;

  FOR v_product_id, v_qty IN
    SELECT
      (item->>'product_id')::UUID,
      SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
    ORDER BY 1
  LOOP
    SELECT public.effective_product_unit_price(
      price, original_price, discount_type, discount_value, discount_start_date, discount_end_date
    )
    INTO v_db_price
    FROM products
    WHERE id = v_product_id
      AND owner_id = v_effective_owner
      AND COALESCE(is_active, true) = true
      AND archived_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_line_total := v_db_price * v_qty;
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
      'selected_size', NULLIF(trim(item->>'selected_size'), ''),
      'selected_color', NULLIF(trim(item->>'selected_color'), '')
    ),
    NOW()
  FROM jsonb_array_elements(p_items) AS t(item)
  JOIN products p ON p.id = (item->>'product_id')::UUID AND p.owner_id = v_effective_owner;

  PERFORM set_config('app.skip_stock_sync', 'on', true);

  UPDATE products p
  SET stock_quantity = CASE
        WHEN p.stock_quantity IS NULL THEN NULL
        WHEN p.stock_quantity >= agg.qty THEN p.stock_quantity - agg.qty
        ELSE p.stock_quantity
      END,
      updated_at = NOW()
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id, SUM((item->>'quantity')::INT)::INT AS qty
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  ) AS agg
  WHERE p.id = agg.product_id
    AND p.owner_id = v_effective_owner
    AND (
      p.stock_quantity IS NULL
      OR p.stock_quantity >= agg.qty
      OR public.product_variant_stock_sum(p.variants) >= agg.qty
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_item_count THEN
    RAISE EXCEPTION 'stock_deduction_failed' USING ERRCODE = 'P0001';
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

  PERFORM set_config('app.skip_stock_sync', 'off', true);

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
  PERFORM set_config('app.skip_stock_sync', 'off', true);
  IF SQLERRM = 'stock_deduction_failed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient stock');
  END IF;
  IF SQLERRM = 'total_amount_mismatch' THEN
    RETURN jsonb_build_object('success', false, 'error', 'total_amount_mismatch');
  END IF;
  IF SQLSTATE = '23505' THEN
    v_recovery := public.checkout_resolve_duplicate_order(v_effective_owner, p_idempotency_key, p_order_id);
    IF v_recovery IS NOT NULL THEN
      RETURN v_recovery;
    END IF;
  END IF;
  RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Orders list: batch order_items + page cap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_merchant_orders(
  p_owner_id uuid,
  p_page int DEFAULT 0,
  p_page_size int DEFAULT 50,
  p_search text DEFAULT NULL,
  p_workflow_tab text DEFAULT 'all',
  p_order_status text DEFAULT 'all',
  p_payment_status text DEFAULT 'all',
  p_delivery_status text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_min_value numeric DEFAULT NULL,
  p_max_value numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_orders jsonb;
  v_limit int;
  v_offset int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_page, 0), 0) * v_limit;

  SELECT COUNT(*) INTO v_total
  FROM public.merchant_orders_base_filter(
    p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
    p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
  );

  WITH page_orders AS (
    SELECT o.*
    FROM public.merchant_orders_base_filter(
      p_owner_id, p_search, p_order_status, p_payment_status, p_delivery_status,
      p_workflow_tab, p_date_from, p_date_to, p_min_value, p_max_value
    ) o
    ORDER BY o.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ),
  items_by_order AS (
    SELECT
      oi.order_id,
      jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'product_price', oi.product_price,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal,
          'variant_metadata', oi.variant_metadata
        )
      ) AS order_items
    FROM public.order_items oi
    INNER JOIN page_orders po ON po.id = oi.order_id
    GROUP BY oi.order_id
  )
  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_created DESC), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT
      jsonb_build_object(
        'id', po.id,
        'status', po.status,
        'total_amount', po.total_amount,
        'created_at', po.created_at,
        'updated_at', po.updated_at,
        'customer_name', po.customer_name,
        'customer_phone', po.customer_phone,
        'customer_address', po.customer_address,
        'customer_governorate', po.customer_governorate,
        'notes', po.notes,
        'delivery_fee', po.delivery_fee,
        'delivery_status', po.delivery_status,
        'payment_method', po.payment_method,
        'payment_status', po.payment_status,
        'coupon_code', po.coupon_code,
        'discount_amount', po.discount_amount,
        'order_items', COALESCE(ib.order_items, '[]'::jsonb)
      ) AS row_data,
      po.created_at AS sort_created
    FROM page_orders po
    LEFT JOIN items_by_order ib ON ib.order_id = po.id
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', GREATEST(COALESCE(p_page, 0), 0),
    'page_size', v_limit,
    'orders', v_orders
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Performance indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_owner_created
  ON public.inventory_movements (product_id, owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_owner_idempotency
  ON public.orders (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (19, 'deep_audit: tenant lockdown, checkout idempotency, orders list perf')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
