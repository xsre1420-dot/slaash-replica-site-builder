-- Comprehensive security, consistency, and multi-tenant fixes

-- =============================================================================
-- Schema additions
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash_on_delivery';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_owner_idempotency
  ON public.orders (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_metadata JSONB;

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  quantity_delta INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_order_reason
  ON public.inventory_movements (order_id, reason);

-- =============================================================================
-- Hardened atomic order creation (server-side pricing, idempotency, variants)
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
  p_payment_method TEXT DEFAULT 'cash_on_delivery'
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_product_id UUID;
  v_qty INT;
  v_stock INT;
  v_db_price DECIMAL;
  v_db_name TEXT;
  v_variants JSONB;
  v_item JSONB;
  v_line_total DECIMAL := 0;
  v_computed_total DECIMAL := 0;
  v_delivery_fee DECIMAL := 0;
  v_item_count INT;
  v_updated_count INT;
  v_selected_size TEXT;
  v_selected_color TEXT;
  v_variant_qty INT;
  v_found_variant BOOLEAN;
  v_variant_elem JSONB;
  v_result JSONB;
  v_existing_order UUID;
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

  -- Delivery fee from store settings (server-side)
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

  -- Lock products, validate variant stock, compute server-side prices
  FOR v_product_id, v_qty IN
    SELECT
      (item->>'product_id')::UUID,
      SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  LOOP
    SELECT COALESCE(stock_quantity, 0), price, name, variants
    INTO v_stock, v_db_price, v_db_name, v_variants
    FROM products
    WHERE id = v_product_id
      AND owner_id = p_owner_id
      AND COALESCE(is_active, true) = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
    END IF;

    v_line_total := v_db_price * v_qty;

    -- Validate per-line variants when present in payload
    FOR v_item IN SELECT item FROM jsonb_array_elements(p_items) AS t(item) LOOP
      IF (v_item->>'product_id')::UUID <> v_product_id THEN
        CONTINUE;
      END IF;

      v_selected_size := NULLIF(trim(v_item->>'selected_size'), '');
      v_selected_color := NULLIF(trim(v_item->>'selected_color'), '');

      IF v_variants IS NOT NULL AND jsonb_typeof(v_variants) = 'array' AND jsonb_array_length(v_variants) > 0 THEN
        v_found_variant := false;
        FOR v_variant_elem IN SELECT value FROM jsonb_array_elements(v_variants) LOOP
          IF (v_selected_size IS NULL OR v_variant_elem->>'size' = v_selected_size)
             AND (v_selected_color IS NULL OR v_variant_elem->>'color' = v_selected_color) THEN
            v_variant_qty := COALESCE((v_variant_elem->>'quantity')::INT, 0);
            IF v_variant_qty < (v_item->>'quantity')::INT THEN
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

    v_computed_total := v_computed_total + v_line_total;
  END LOOP;

  v_computed_total := v_computed_total + COALESCE(v_delivery_fee, 0);

  IF p_total_amount IS NOT NULL AND ABS(p_total_amount - v_computed_total) > 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
  END IF;

  INSERT INTO orders (
    id, owner_id, idempotency_key, customer_name, customer_phone, customer_address,
    total_amount, status, notes, customer_governorate, payment_method, created_at, updated_at
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
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    order_id, product_id, product_name, product_price, quantity, subtotal, variant_metadata, created_at
  )
  SELECT
    v_order_id,
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

  INSERT INTO inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
  SELECT v_order_id, (item->>'product_id')::UUID, p_owner_id, -SUM((item->>'quantity')::INT)::INT, 'order_created'
  FROM jsonb_array_elements(p_items) AS t(item)
  GROUP BY (item->>'product_id')::UUID;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'total_amount', v_computed_total);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Order could not be processed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_deduction(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB, TEXT
) TO anon, authenticated;

-- Drop old function signature if exists
DROP FUNCTION IF EXISTS public.create_order_with_stock_deduction(UUID, UUID, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB);

-- =============================================================================
-- Lock down direct order inserts (orders only via RPC)
-- =============================================================================

DROP POLICY IF EXISTS "Restricted order creation" ON public.orders;
DROP POLICY IF EXISTS "Restricted order item creation" ON public.order_items;

REVOKE INSERT ON public.orders FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;

-- =============================================================================
-- Fix categories RLS (remove cross-tenant leak)
-- =============================================================================

DROP POLICY IF EXISTS "Secure public store categories access" ON public.categories;

CREATE POLICY "Owners can view their own categories"
  ON public.categories FOR SELECT
  USING (owner_id = auth.uid());

-- =============================================================================
-- Fix suggested products public leak
-- =============================================================================

DROP POLICY IF EXISTS "Public can view suggested products" ON public.suggested_products;

CREATE POLICY "Owners manage suggested products"
  ON public.suggested_products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = suggested_products.product_id AND p.owner_id = auth.uid()
  ));

-- =============================================================================
-- Revoke dangerous SECURITY DEFINER functions from public
-- =============================================================================

REVOKE ALL ON FUNCTION public.cleanup_orphaned_reviews() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_orphaned_suggestions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_reviews() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_suggestions() TO service_role;

-- =============================================================================
-- Remove security audit triggers polluting store_visits
-- =============================================================================

DROP TRIGGER IF EXISTS categories_security_log ON public.categories;
DROP TRIGGER IF EXISTS products_security_log ON public.products;

-- =============================================================================
-- Customer stats: reverse on cancel
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.customers (owner_id, phone, name, first_order_date, last_order_date, total_orders, total_spent)
    VALUES (NEW.owner_id, NEW.customer_phone, NEW.customer_name, NEW.created_at, NEW.created_at, 1, NEW.total_amount)
    ON CONFLICT (owner_id, phone)
    DO UPDATE SET
      name = COALESCE(EXCLUDED.name, customers.name),
      last_order_date = EXCLUDED.last_order_date,
      total_orders = customers.total_orders + 1,
      total_spent = customers.total_spent + EXCLUDED.total_spent,
      updated_at = now();
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    UPDATE public.customers
    SET
      total_orders = GREATEST(total_orders - 1, 0),
      total_spent = GREATEST(total_spent - OLD.total_amount, 0),
      updated_at = now()
    WHERE owner_id = OLD.owner_id AND phone = OLD.customer_phone;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_customer_stats ON public.orders;
CREATE TRIGGER trigger_update_customer_stats
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_stats();

-- =============================================================================
-- Stock restore with idempotency via inventory_movements ledger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS TRIGGER AS $$
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

    INSERT INTO inventory_movements (order_id, product_id, owner_id, quantity_delta, reason)
    SELECT NEW.id, oi.product_id, NEW.owner_id, oi.quantity, 'order_cancelled'
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- Public product fetch by store slug (for tenant product detail pages)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_store_product_by_id(
  p_slug TEXT,
  p_product_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_product JSONB;
BEGIN
  IF p_slug IS NULL OR p_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_slug !~ '^[a-z0-9-]+$' THEN
    RETURN NULL;
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM store_settings
  WHERE LOWER(store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(p.*) INTO v_product
  FROM products p
  WHERE p.id = p_product_id
    AND p.owner_id = v_owner_id
    AND COALESCE(p.is_active, true) = true;

  RETURN v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_product_by_id(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_product_by_id(TEXT, UUID) TO anon, authenticated;

-- =============================================================================
-- Product reviews: public insert pending approval only
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can insert product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Public can insert reviews" ON public.product_reviews;

CREATE POLICY "Public can submit pending reviews"
  ON public.product_reviews FOR INSERT
  WITH CHECK (
    is_approved = false
    AND EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id AND COALESCE(p.is_active, true) = true
    )
  );

CREATE POLICY "Owners approve reviews"
  ON public.product_reviews FOR UPDATE
  USING (owner_id = auth.uid());
