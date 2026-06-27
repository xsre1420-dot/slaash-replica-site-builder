-- Atomic order creation with stock deduction (single transaction)
-- Validates tenant ownership, locks product rows, and aggregates duplicate line items.

CREATE OR REPLACE FUNCTION public.create_order_with_stock_deduction(
  p_order_id UUID,
  p_owner_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_address TEXT,
  p_total_amount DECIMAL,
  p_customer_governorate TEXT,
  p_notes TEXT,
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_product_id UUID;
  v_qty INT;
  v_stock INT;
  v_item_count INT;
  v_updated_count INT;
  v_result JSONB;
BEGIN
  SET LOCAL search_path = public;

  IF p_order_id IS NULL OR p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Order ID and owner ID are required';
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;

  IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Customer phone is required';
  END IF;

  IF p_customer_address IS NULL OR trim(p_customer_address) = '' THEN
    RAISE EXCEPTION 'Customer address is required';
  END IF;

  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Order total must be greater than zero';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
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
    RAISE EXCEPTION 'Order items are invalid';
  END IF;

  -- Lock products and validate stock + tenant ownership before any writes
  FOR v_product_id, v_qty IN
    SELECT
      (item->>'product_id')::UUID,
      SUM((item->>'quantity')::INT)::INT
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  LOOP
    SELECT COALESCE(stock_quantity, 0)
    INTO v_stock
    FROM products
    WHERE id = v_product_id
      AND owner_id = p_owner_id
      AND COALESCE(is_active, true) = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % is unavailable for this store', v_product_id;
    END IF;

    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;
  END LOOP;

  INSERT INTO orders (
    id,
    owner_id,
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    status,
    notes,
    customer_governorate,
    created_at,
    updated_at
  ) VALUES (
    p_order_id,
    p_owner_id,
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_customer_address),
    p_total_amount,
    'pending',
    p_notes,
    p_customer_governorate,
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    order_id,
    product_id,
    product_name,
    product_price,
    quantity,
    subtotal,
    created_at
  )
  SELECT
    v_order_id,
    (item->>'product_id')::UUID,
    (item->>'product_name')::TEXT,
    (item->>'product_price')::DECIMAL,
    (item->>'quantity')::INT,
    (item->>'subtotal')::DECIMAL,
    NOW()
  FROM jsonb_array_elements(p_items) AS t(item);

  UPDATE products p
  SET stock_quantity = p.stock_quantity - agg.qty,
      updated_at = NOW()
  FROM (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      SUM((item->>'quantity')::INT)::INT AS qty
    FROM jsonb_array_elements(p_items) AS t(item)
    GROUP BY (item->>'product_id')::UUID
  ) AS agg
  WHERE p.id = agg.product_id
    AND p.owner_id = p_owner_id
    AND p.stock_quantity >= agg.qty;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> v_item_count THEN
    RAISE EXCEPTION 'Stock deduction failed due to concurrent update';
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'message', 'Order created and stock deducted successfully'
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_order_with_stock_deduction(UUID, UUID, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_deduction(UUID, UUID, TEXT, TEXT, TEXT, DECIMAL, TEXT, TEXT, JSONB) TO anon, authenticated;

-- Audit log for order creation
CREATE TABLE IF NOT EXISTS public.order_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  details JSONB
);

ALTER TABLE public.order_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only store owners can view their order audit logs" ON public.order_audit_log;
CREATE POLICY "Only store owners can view their order audit logs"
  ON public.order_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders WHERE id = order_id AND owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.log_order_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_audit_log (order_id, action, details)
  VALUES (
    NEW.id,
    'CREATED',
    jsonb_build_object(
      'owner_id', NEW.owner_id,
      'total_amount', NEW.total_amount,
      'customer_name', NEW.customer_name
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS order_creation_log_trigger ON public.orders;
CREATE TRIGGER order_creation_log_trigger
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_creation();

-- Restore inventory when a pending order is cancelled
CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    UPDATE products p
    SET stock_quantity = p.stock_quantity + oi.quantity,
        updated_at = NOW()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.owner_id = NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS order_cancel_restore_stock_trigger ON public.orders;
CREATE TRIGGER order_cancel_restore_stock_trigger
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status = 'pending')
EXECUTE FUNCTION public.restore_stock_on_order_cancel();
