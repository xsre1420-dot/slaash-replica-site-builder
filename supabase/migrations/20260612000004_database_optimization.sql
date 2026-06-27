-- Database optimization: schema baseline, FKs, indexes, constraints, variant stock, RLS

-- =============================================================================
-- Legacy tables skipped by baseline (create if absent — no data loss)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  minimum_order_amount NUMERIC DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL UNIQUE,
  meta_pixel_id TEXT,
  facebook_access_token TEXT,
  google_analytics_id TEXT,
  marketing_enabled BOOLEAN DEFAULT false,
  email_marketing_enabled BOOLEAN DEFAULT false,
  sms_marketing_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suggested_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  suggested_product_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggested_products ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Schema baseline (columns referenced by RPCs but missing from early migrations)
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_governorate TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash_on_delivery';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_metadata JSONB,
  ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Backfill order_items.owner_id from orders (avoids RLS subquery on every row)
UPDATE public.order_items oi
SET owner_id = o.owner_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.owner_id IS NULL;

-- Drop redundant legacy JSONB cart snapshot (canonical source: order_items)
ALTER TABLE public.orders DROP COLUMN IF EXISTS items;

-- =============================================================================
-- Helper: adjust variant quantities inside products.variants JSONB
-- =============================================================================

CREATE OR REPLACE FUNCTION public.adjust_product_variants(
  p_variants JSONB,
  p_size TEXT,
  p_color TEXT,
  p_qty_delta INT
) RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN (p_size IS NULL OR elem->>'size' = p_size)
         AND (p_color IS NULL OR elem->>'color' = p_color)
        THEN jsonb_set(
          elem,
          '{quantity}',
          to_jsonb(GREATEST(0, COALESCE((elem->>'quantity')::INT, 0) + p_qty_delta))
        )
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb)) AS t(elem);
$$;

-- =============================================================================
-- Constraints
-- =============================================================================

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled'));

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_qty_positive;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_qty_positive CHECK (quantity > 0);

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_subtotal_nonneg;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_subtotal_nonneg CHECK (subtotal >= 0);

ALTER TABLE public.marketing_coupons DROP CONSTRAINT IF EXISTS coupons_usage_within_limit;
ALTER TABLE public.marketing_coupons
  ADD CONSTRAINT coupons_usage_within_limit
  CHECK (usage_limit IS NULL OR used_count <= usage_limit);

-- =============================================================================
-- Indexes for common query patterns
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_products_owner_name
  ON public.products (owner_id, name);

CREATE INDEX IF NOT EXISTS idx_marketing_coupons_owner_created
  ON public.marketing_coupons (owner_id, created_at DESC);

DROP INDEX IF EXISTS idx_marketing_coupons_owner_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_coupons_owner_code_ci
  ON public.marketing_coupons (owner_id, upper(code));

CREATE INDEX IF NOT EXISTS idx_marketing_coupons_active_lookup
  ON public.marketing_coupons (owner_id, upper(code))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_reviews_product_owner_approved
  ON public.product_reviews (product_id, owner_id, is_approved, created_at DESC)
  WHERE is_approved = true;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_owner_created
  ON public.inventory_movements (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_owner_order
  ON public.order_items (owner_id, order_id);

-- =============================================================================
-- Foreign keys (clean orphans first)
-- =============================================================================

DELETE FROM public.product_reviews pr
WHERE to_regclass('public.product_reviews') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = pr.product_id);

DO $$
BEGIN
  IF to_regclass('public.suggested_products') IS NOT NULL THEN
    DELETE FROM public.suggested_products sp
    WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = sp.product_id)
       OR NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = sp.suggested_product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_owner_id_fkey') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_owner_id_fkey') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_owner_id_fkey') THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_owner_id_fkey') THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_product_id_fkey') THEN
    ALTER TABLE public.product_reviews
      ADD CONSTRAINT product_reviews_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suggested_products_product_id_fkey') THEN
    ALTER TABLE public.suggested_products
      ADD CONSTRAINT suggested_products_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suggested_products_suggested_product_id_fkey') THEN
    ALTER TABLE public.suggested_products
      ADD CONSTRAINT suggested_products_suggested_product_id_fkey
      FOREIGN KEY (suggested_product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketing_coupons_owner_id_fkey') THEN
    ALTER TABLE public.marketing_coupons
      ADD CONSTRAINT marketing_coupons_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_owner_id_fkey') THEN
    ALTER TABLE public.inventory_movements
      ADD CONSTRAINT inventory_movements_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_owner_id_fkey') THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some FK constraints could not be added: %', SQLERRM;
END $$;

-- =============================================================================
-- RLS hardening
-- =============================================================================

DROP POLICY IF EXISTS "Public can view approved product reviews" ON public.product_reviews;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view inventory movements" ON public.inventory_movements;
CREATE POLICY "Owners view inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners manage inventory movements" ON public.inventory_movements;
CREATE POLICY "Owners manage inventory movements"
  ON public.inventory_movements FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Faster order_items RLS via denormalized owner_id
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can update their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can delete their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can insert their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can update their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Restaurant owners can delete their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can update order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can delete order items for their orders" ON public.order_items;

CREATE POLICY "Owners view order items"
  ON public.order_items FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners manage order items"
  ON public.order_items FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Remove review audit trigger polluting store_visits
DROP TRIGGER IF EXISTS audit_product_reviews_changes ON public.product_reviews;

-- =============================================================================
-- Aggregated statistics RPC (single round-trip for dashboard KPIs)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_store_statistics(
  p_owner_id UUID,
  p_days INT DEFAULT 7
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN NULL;
  END IF;

  v_since := NOW() - (GREATEST(p_days, 1) || ' days')::INTERVAL;

  SELECT jsonb_build_object(
    'order_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id AND created_at >= v_since
    ),
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders
      WHERE owner_id = p_owner_id AND status = 'pending' AND created_at >= v_since
    ),
    'completed_revenue', (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM orders
      WHERE owner_id = p_owner_id AND status = 'completed' AND created_at >= v_since
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
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_statistics(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_statistics(UUID, INT) TO authenticated;

-- =============================================================================
-- Order RPC: deterministic locking + variant deduction + order_items.owner_id
-- =============================================================================

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
  p_coupon_code TEXT DEFAULT NULL
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
BEGIN
  SET LOCAL search_path = public;

  IF p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existing_order
    FROM orders
    WHERE owner_id = p_owner_id AND idempotency_key = trim(p_idempotency_key)
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
        WHERE ss.owner_id = p_owner_id
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

  -- Deterministic lock order (deadlock prevention)
  PERFORM 1
  FROM products p
  INNER JOIN (
    SELECT DISTINCT (item->>'product_id')::UUID AS id
    FROM jsonb_array_elements(p_items) AS t(item)
    WHERE (item->>'quantity')::INT > 0
  ) ids ON p.id = ids.id
  WHERE p.owner_id = p_owner_id AND COALESCE(p.is_active, true) = true
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
      AND owner_id = p_owner_id
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
    WHERE owner_id = p_owner_id
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
    p_owner_id,
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
    p_owner_id,
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
  JOIN products p ON p.id = (item->>'product_id')::UUID AND p.owner_id = p_owner_id;

  UPDATE products p
  SET stock_quantity = p.stock_quantity - agg.qty,
      updated_at = NOW()
  FROM (
    SELECT (item->>'product_id')::UUID AS product_id, SUM((item->>'quantity')::INT)::INT AS qty
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  ) AS agg
  WHERE p.id = agg.product_id AND p.owner_id = p_owner_id AND p.stock_quantity >= agg.qty;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_item_count THEN
    RAISE EXCEPTION 'stock_deduction_failed';
  END IF;

  -- Deduct variant-level stock
  FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
    v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
    v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');
    v_line_qty := (v_item->>'quantity')::INT;

    IF v_selected_size IS NOT NULL OR v_selected_color IS NOT NULL THEN
      UPDATE products p
      SET variants = adjust_product_variants(p.variants, v_selected_size, v_selected_color, -v_line_qty),
          updated_at = NOW()
      WHERE p.id = (v_item->>'product_id')::UUID
        AND p.owner_id = p_owner_id
        AND p.variants IS NOT NULL
        AND jsonb_typeof(p.variants) = 'array'
        AND jsonb_array_length(p.variants) > 0;
    END IF;
  END LOOP;

  INSERT INTO inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
  SELECT v_order_id, (item->>'product_id')::UUID, p_owner_id, -SUM((item->>'quantity')::INT)::INT, 'order_created'
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

-- =============================================================================
-- Cancel trigger: restore aggregate + variant stock + coupon usage
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS TRIGGER AS $$
DECLARE
  oi RECORD;
  v_size TEXT;
  v_color TEXT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    IF EXISTS (
      SELECT 1 FROM inventory_movements
      WHERE order_id = NEW.id AND reason = 'order_cancelled'
    ) THEN
      RETURN NEW;
    END IF;

    UPDATE products p
    SET stock_quantity = p.stock_quantity + oi.quantity,
        updated_at = NOW()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.owner_id = NEW.owner_id;

    FOR oi IN
      SELECT product_id, quantity, variant_metadata
      FROM order_items
      WHERE order_id = NEW.id
    LOOP
      v_size := NULLIF(trim(oi.variant_metadata->>'selected_size'), '');
      v_color := NULLIF(trim(oi.variant_metadata->>'selected_color'), '');

      IF v_size IS NOT NULL OR v_color IS NOT NULL THEN
        UPDATE products p
        SET variants = adjust_product_variants(p.variants, v_size, v_color, oi.quantity),
            updated_at = NOW()
        WHERE p.id = oi.product_id AND p.owner_id = NEW.owner_id;
      END IF;
    END LOOP;

    INSERT INTO inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
    SELECT NEW.id, oi.product_id, NEW.owner_id, oi.quantity, 'order_cancelled'
    FROM order_items oi
    WHERE oi.order_id = NEW.id;

    IF NEW.coupon_code IS NOT NULL AND trim(NEW.coupon_code) <> '' THEN
      UPDATE marketing_coupons
      SET used_count = GREATEST(0, used_count - 1), updated_at = NOW()
      WHERE owner_id = NEW.owner_id
        AND upper(code) = upper(trim(NEW.coupon_code))
        AND used_count > 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS order_cancel_restore_stock_trigger ON public.orders;
CREATE TRIGGER order_cancel_restore_stock_trigger
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_stock_on_order_cancel();
