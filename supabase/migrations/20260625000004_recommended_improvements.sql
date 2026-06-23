-- Recommended improvements: variant restock, checkout errors, daily stats rollups

-- ---------------------------------------------------------------------------
-- 1) Scale variant quantities to a new aggregate total (mirrors client logic)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scale_variants_to_total(
  p_variants JSONB,
  p_new_total INT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_len INT;
  v_current INT;
  v_scaled JSONB := '[]'::jsonb;
  v_elem JSONB;
  v_i INT;
  v_scaled_sum INT;
  v_remainder INT;
  v_base INT;
  v_extra INT;
BEGIN
  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' OR jsonb_array_length(p_variants) = 0 THEN
    RETURN p_variants;
  END IF;

  IF p_new_total < 0 THEN
    p_new_total := 0;
  END IF;

  v_len := jsonb_array_length(p_variants);

  SELECT COALESCE(SUM(COALESCE((elem->>'quantity')::INT, 0)), 0)::INT
  INTO v_current
  FROM jsonb_array_elements(p_variants) AS t(elem);

  IF v_current <= 0 THEN
    v_base := p_new_total / v_len;
    v_extra := p_new_total % v_len;
    FOR v_i IN 0..(v_len - 1) LOOP
      v_elem := p_variants -> v_i;
      v_scaled := v_scaled || jsonb_build_array(
        jsonb_set(
          v_elem,
          '{quantity}',
          to_jsonb(v_base + CASE WHEN v_i < v_extra THEN 1 ELSE 0 END)
        )
      );
    END LOOP;
    RETURN v_scaled;
  END IF;

  FOR v_i IN 0..(v_len - 1) LOOP
    v_elem := p_variants -> v_i;
    v_scaled := v_scaled || jsonb_build_array(
      jsonb_set(
        v_elem,
        '{quantity}',
        to_jsonb(
          FLOOR(
            (COALESCE((v_elem->>'quantity')::NUMERIC, 0) / v_current) * p_new_total
          )::INT
        )
      )
    );
  END LOOP;

  SELECT COALESCE(SUM(COALESCE((elem->>'quantity')::INT, 0)), 0)::INT
  INTO v_scaled_sum
  FROM jsonb_array_elements(v_scaled) AS t(elem);

  v_remainder := p_new_total - v_scaled_sum;
  IF v_remainder > 0 THEN
    v_elem := (v_scaled -> 0);
    v_scaled := jsonb_set(
      v_scaled,
      '{0}',
      jsonb_set(
        v_elem,
        '{quantity}',
        to_jsonb(COALESCE((v_elem->>'quantity')::INT, 0) + v_remainder)
      )
    );
  END IF;

  RETURN v_scaled;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Atomic restock — supports variant products
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_product_stock(
  p_product_id UUID,
  p_owner_id UUID,
  p_delta INT,
  p_reason TEXT DEFAULT 'restock'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INT;
  v_variants JSONB;
  v_new_qty INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_product_id IS NULL OR p_delta IS NULL OR p_delta <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_delta');
  END IF;

  SELECT stock_quantity, variants
  INTO v_stock, v_variants
  FROM public.products
  WHERE id = p_product_id
    AND owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_new_qty := COALESCE(v_stock, 0) + p_delta;

  PERFORM set_config('app.skip_stock_sync', 'on', true);

  IF v_variants IS NOT NULL
     AND jsonb_typeof(v_variants) = 'array'
     AND jsonb_array_length(v_variants) > 0 THEN
    v_variants := public.scale_variants_to_total(v_variants, v_new_qty);
  END IF;

  UPDATE public.products
  SET stock_quantity = v_new_qty,
      variants = v_variants,
      updated_at = NOW()
  WHERE id = p_product_id
    AND owner_id = p_owner_id;

  PERFORM set_config('app.skip_stock_sync', 'off', true);

  INSERT INTO public.inventory_movements (product_id, owner_id, quantity_delta, reason)
  VALUES (p_product_id, p_owner_id, p_delta, COALESCE(NULLIF(trim(p_reason), ''), 'restock'));

  RETURN jsonb_build_object('success', true, 'stock_quantity', v_new_qty);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.skip_stock_sync', 'off', true);
  RETURN jsonb_build_object('success', false, 'error', 'restock_failed');
END;
$$;

REVOKE ALL ON FUNCTION public.increment_product_stock(UUID, UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(UUID, UUID, INT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Checkout: generic client-facing errors (no SQLERRM leak)
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
) RETURNS JSONB AS $$
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
  RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 4) Daily stats rollups (orders + visits)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_daily_stats (
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  order_count INT NOT NULL DEFAULT 0,
  completed_order_count INT NOT NULL DEFAULT 0,
  cancelled_order_count INT NOT NULL DEFAULT 0,
  gross_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
  completed_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
  visit_count INT NOT NULL DEFAULT 0,
  unique_visitors INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_store_daily_stats_owner_date
  ON public.store_daily_stats (owner_id, stat_date DESC);

ALTER TABLE public.store_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_daily_stats_owner ON public.store_daily_stats;
CREATE POLICY store_daily_stats_owner
  ON public.store_daily_stats
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

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
  INSERT INTO public.store_daily_stats (owner_id, stat_date, order_count, completed_order_count, cancelled_order_count, gross_revenue, completed_revenue)
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

CREATE OR REPLACE FUNCTION public.trg_orders_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.upsert_store_daily_order_stats(
      NEW.owner_id,
      (NEW.created_at AT TIME ZONE 'UTC')::DATE,
      COALESCE(NEW.status, 'pending'),
      COALESCE(NEW.total_amount, 0),
      1
    );
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_daily_stats_trg ON public.orders;
CREATE TRIGGER orders_daily_stats_trg
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_orders_daily_stats();

CREATE OR REPLACE FUNCTION public.trg_visits_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_daily_stats (owner_id, stat_date, visit_count, unique_visitors)
  VALUES (NEW.owner_id, (NEW.created_at AT TIME ZONE 'UTC')::DATE, 1, 1)
  ON CONFLICT (owner_id, stat_date) DO UPDATE SET
    visit_count = store_daily_stats.visit_count + 1,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visits_daily_stats_trg ON public.store_visits;
CREATE TRIGGER visits_daily_stats_trg
  AFTER INSERT ON public.store_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_visits_daily_stats();

-- Extend statistics RPC to use rollups for heavy aggregates
CREATE OR REPLACE FUNCTION public.get_store_statistics(
  p_owner_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start_date DATE;
  v_end_date DATE;
  v_rollup_orders INT;
  v_rollup_completed INT;
  v_rollup_revenue NUMERIC;
  v_rollup_visits INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN NULL;
  END IF;

  v_start_date := (p_start AT TIME ZONE 'UTC')::DATE;
  v_end_date := (p_end AT TIME ZONE 'UTC')::DATE;

  SELECT
    COALESCE(SUM(order_count - cancelled_order_count), 0)::INT,
    COALESCE(SUM(completed_order_count), 0)::INT,
    COALESCE(SUM(completed_revenue), 0),
    COALESCE(SUM(visit_count), 0)::INT
  INTO v_rollup_orders, v_rollup_completed, v_rollup_revenue, v_rollup_visits
  FROM public.store_daily_stats
  WHERE owner_id = p_owner_id
    AND stat_date >= v_start_date
    AND stat_date <= v_end_date;

  SELECT jsonb_build_object(
    'order_count', COALESCE(v_rollup_orders, (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id
        AND created_at >= p_start AND created_at <= p_end
        AND status <> 'cancelled'
    )),
    'completed_order_count', COALESCE(v_rollup_completed, (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id
        AND created_at >= p_start AND created_at <= p_end
        AND status = 'completed'
    )),
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id
        AND status = 'pending'
        AND created_at >= p_start
        AND created_at <= p_end
    ),
    'completed_revenue', COALESCE(v_rollup_revenue, (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM orders
      WHERE owner_id = p_owner_id
        AND status = 'completed'
        AND created_at >= p_start
        AND created_at <= p_end
    )),
    'refund_total', (
      SELECT COALESCE(SUM(r.amount), 0)
      FROM order_refunds r
      JOIN orders o ON o.id = r.order_id
      WHERE r.owner_id = p_owner_id
        AND r.status = 'completed'
        AND o.status = 'completed'
        AND o.created_at >= p_start
        AND o.created_at <= p_end
    ),
    'visit_count', COALESCE(v_rollup_visits, (
      SELECT COUNT(*)::INT FROM store_visits
      WHERE owner_id = p_owner_id
        AND created_at >= p_start
        AND created_at <= p_end
    )),
    'unique_visitors', (
      SELECT COUNT(DISTINCT visitor_ip)::INT FROM store_visits
      WHERE owner_id = p_owner_id
        AND created_at >= p_start
        AND created_at <= p_end
        AND visitor_ip IS NOT NULL
        AND trim(visitor_ip) <> ''
    ),
    'low_stock_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id
        AND COALESCE(is_active, true) = true
        AND COALESCE(stock_quantity, 0) <= COALESCE(min_stock_level, 5)
    ),
    'product_count', (
      SELECT COUNT(*)::INT FROM products
      WHERE owner_id = p_owner_id AND COALESCE(is_active, true) = true
    ),
    'new_customers', (
      SELECT COUNT(*)::INT FROM customers
      WHERE owner_id = p_owner_id
        AND first_order_date >= p_start
        AND first_order_date <= p_end
    ),
    'returning_customers', (
      SELECT COUNT(*)::INT FROM customers c
      WHERE c.owner_id = p_owner_id
        AND c.first_order_date < p_start
        AND c.last_order_date >= p_start
        AND c.last_order_date <= p_end
    ),
    'top_viewed_products', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.view_count DESC)
      FROM (
        SELECT
          pv.product_id,
          COALESCE(p.name, 'منتج') AS product_name,
          COUNT(*)::INT AS view_count
        FROM product_views pv
        LEFT JOIN products p ON p.id = pv.product_id AND p.owner_id = pv.owner_id
        WHERE pv.owner_id = p_owner_id
          AND pv.created_at >= p_start
          AND pv.created_at <= p_end
        GROUP BY pv.product_id, p.name
        ORDER BY view_count DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'campaign_attribution', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.orders DESC)
      FROM (
        SELECT
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_source'), ''), '(direct)') AS source,
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_medium'), ''), '(none)') AS medium,
          COALESCE(NULLIF(trim(o.marketing_attribution->>'utm_campaign'), ''), '(none)') AS campaign,
          COUNT(*)::INT AS orders,
          COALESCE(SUM(
            CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END
          ), 0)::NUMERIC AS revenue
        FROM orders o
        WHERE o.owner_id = p_owner_id
          AND o.created_at >= p_start
          AND o.created_at <= p_end
          AND o.status <> 'cancelled'
          AND o.marketing_attribution IS NOT NULL
          AND o.marketing_attribution <> 'null'::jsonb
        GROUP BY 1, 2, 3
        ORDER BY orders DESC
        LIMIT 20
      ) t
    ), '[]'::jsonb),
    'stats_source', 'daily_rollup'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

GRANT EXECUTE ON FUNCTION public.platform_health_check() TO service_role;

-- Backfill daily rollups from historical data
INSERT INTO public.store_daily_stats (
  owner_id, stat_date, order_count, completed_order_count, cancelled_order_count, gross_revenue, completed_revenue
)
SELECT
  o.owner_id,
  (o.created_at AT TIME ZONE 'UTC')::DATE AS stat_date,
  COUNT(*) FILTER (WHERE o.status <> 'cancelled')::INT,
  COUNT(*) FILTER (WHERE o.status = 'completed')::INT,
  COUNT(*) FILTER (WHERE o.status = 'cancelled')::INT,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'cancelled'), 0),
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0)
FROM public.orders o
GROUP BY o.owner_id, (o.created_at AT TIME ZONE 'UTC')::DATE
ON CONFLICT (owner_id, stat_date) DO UPDATE SET
  order_count = EXCLUDED.order_count,
  completed_order_count = EXCLUDED.completed_order_count,
  cancelled_order_count = EXCLUDED.cancelled_order_count,
  gross_revenue = EXCLUDED.gross_revenue,
  completed_revenue = EXCLUDED.completed_revenue,
  updated_at = NOW();

INSERT INTO public.store_daily_stats (owner_id, stat_date, visit_count)
SELECT
  v.owner_id,
  (v.created_at AT TIME ZONE 'UTC')::DATE,
  COUNT(*)::INT
FROM public.store_visits v
GROUP BY v.owner_id, (v.created_at AT TIME ZONE 'UTC')::DATE
ON CONFLICT (owner_id, stat_date) DO UPDATE SET
  visit_count = EXCLUDED.visit_count,
  updated_at = NOW();

INSERT INTO public.platform_schema_version (version, notes)
VALUES (14, 'recommended_improvements: variant restock, daily stats, checkout errors')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
