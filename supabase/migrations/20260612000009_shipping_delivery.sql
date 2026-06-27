-- Shipping & delivery: fees persistence, shipments, tracking, failed delivery

-- =============================================================================
-- Order delivery columns
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN (
      'pending',
      'preparing',
      'shipped',
      'out_for_delivery',
      'delivered',
      'failed',
      'returned'
    ));

-- =============================================================================
-- Shipments
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_number TEXT,
  carrier TEXT DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'preparing',
      'shipped',
      'out_for_delivery',
      'delivered',
      'failed',
      'returned'
    )),
  delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  estimated_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  delivery_address TEXT,
  governorate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shipment_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_owner ON public.shipments(owner_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON public.shipment_tracking_events(shipment_id);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipments_owner ON public.shipments;
CREATE POLICY shipments_owner ON public.shipments
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS shipment_events_owner ON public.shipment_tracking_events;
CREATE POLICY shipment_events_owner ON public.shipment_tracking_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id AND s.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_id AND s.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- Calculate delivery fee from store settings
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_delivery_fee(
  p_owner_id UUID,
  p_governorate TEXT
)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee DECIMAL := 0;
BEGIN
  IF p_owner_id IS NULL OR p_governorate IS NULL OR trim(p_governorate) = '' THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(
    (
      SELECT (elem->>'price')::DECIMAL
      FROM store_settings ss,
           jsonb_array_elements(COALESCE(ss.delivery_prices, '[]'::jsonb)) AS elem
      WHERE ss.owner_id = p_owner_id
        AND elem->>'governorate' = trim(p_governorate)
      LIMIT 1
    ),
    0
  ) INTO v_fee;

  RETURN v_fee;
END;
$$;

-- =============================================================================
-- Set delivery fee + status before order insert
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_order_delivery_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_fee IS NULL OR NEW.delivery_fee = 0 THEN
    NEW.delivery_fee := public.calculate_delivery_fee(NEW.owner_id, NEW.customer_governorate);
  END IF;

  IF NEW.delivery_status IS NULL THEN
    NEW.delivery_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_set_delivery_fields ON public.orders;
CREATE TRIGGER order_set_delivery_fields
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_delivery_fields();

-- =============================================================================
-- Auto-create shipment on new order
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_shipment_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipment_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM shipments WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO shipments (
    order_id, owner_id, status, delivery_fee,
    recipient_name, recipient_phone, delivery_address, governorate
  ) VALUES (
    NEW.id,
    NEW.owner_id,
    'pending',
    COALESCE(NEW.delivery_fee, 0),
    NEW.customer_name,
    NEW.customer_phone,
    NEW.customer_address,
    NEW.customer_governorate
  )
  RETURNING id INTO v_shipment_id;

  INSERT INTO shipment_tracking_events (shipment_id, status, note)
  VALUES (v_shipment_id, 'pending', 'تم إنشاء الشحنة');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_create_shipment ON public.orders;
CREATE TRIGGER order_create_shipment
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_shipment_for_order();

-- =============================================================================
-- Sync delivery status when order status changes
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_delivery_on_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'pending' THEN
    UPDATE shipments
    SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
    WHERE order_id = NEW.id AND status NOT IN ('failed', 'returned');

    INSERT INTO shipment_tracking_events (shipment_id, status, note)
    SELECT s.id, 'delivered', 'تم التسليم بنجاح'
    FROM shipments s WHERE s.order_id = NEW.id;

    NEW.delivery_status := 'delivered';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    UPDATE shipments
    SET status = 'returned', failed_reason = COALESCE(failed_reason, 'order_cancelled'), updated_at = NOW()
    WHERE order_id = NEW.id;

    INSERT INTO shipment_tracking_events (shipment_id, status, note)
    SELECT s.id, 'returned', 'تم إلغاء الطلب'
    FROM shipments s WHERE s.order_id = NEW.id;

    NEW.delivery_status := 'returned';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_sync_delivery_status ON public.orders;
CREATE TRIGGER order_sync_delivery_status
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_delivery_on_order_status();

-- =============================================================================
-- Update shipment / delivery status (merchant)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_shipment_status(
  p_shipment_id UUID,
  p_owner_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_carrier TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipment RECORD;
  v_allowed TEXT[] := ARRAY['pending','preparing','shipped','out_for_delivery','delivered','failed','returned'];
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF NOT (p_status = ANY(v_allowed)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_shipment FROM shipments WHERE id = p_shipment_id AND owner_id = p_owner_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shipment not found');
  END IF;

  UPDATE shipments
  SET
    status = p_status,
    tracking_number = COALESCE(NULLIF(trim(p_tracking_number), ''), tracking_number),
    carrier = COALESCE(NULLIF(trim(p_carrier), ''), carrier),
    delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END,
    updated_at = NOW()
  WHERE id = p_shipment_id;

  INSERT INTO shipment_tracking_events (shipment_id, status, note)
  VALUES (p_shipment_id, p_status, COALESCE(p_note, 'تحديث حالة الشحنة'));

  UPDATE orders
  SET delivery_status = p_status, updated_at = NOW()
  WHERE id = v_shipment.order_id;

  IF p_status = 'delivered' THEN
    UPDATE orders SET status = 'completed', updated_at = NOW()
    WHERE id = v_shipment.order_id AND status = 'pending';
  END IF;

  RETURN jsonb_build_object('success', true, 'shipment_id', p_shipment_id, 'status', p_status);
END;
$$;

-- =============================================================================
-- Mark delivery failed + optional retry
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_delivery_failed(
  p_shipment_id UUID,
  p_owner_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT order_id INTO v_order_id
  FROM shipments
  WHERE id = p_shipment_id AND owner_id = p_owner_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shipment not found');
  END IF;

  UPDATE shipments
  SET status = 'failed', failed_reason = p_reason, updated_at = NOW()
  WHERE id = p_shipment_id;

  INSERT INTO shipment_tracking_events (shipment_id, status, note)
  VALUES (p_shipment_id, 'failed', COALESCE(p_reason, 'فشل التوصيل'));

  UPDATE orders
  SET delivery_status = 'failed', updated_at = NOW()
  WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'shipment_id', p_shipment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_failed_delivery(
  p_shipment_id UUID,
  p_owner_id UUID,
  p_note TEXT DEFAULT 'إعادة محاولة التوصيل'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.update_shipment_status(
    p_shipment_id, p_owner_id, 'out_for_delivery', p_note, NULL, NULL
  );
END;
$$;

-- =============================================================================
-- Get shipment with tracking events
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_order_shipment(
  p_order_id UUID,
  p_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipment JSONB;
  v_events JSONB;
  v_order RECORD;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT delivery_fee, delivery_status, customer_governorate, total_amount
  INTO v_order
  FROM orders
  WHERE id = p_order_id AND owner_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT to_jsonb(s) INTO v_shipment
  FROM shipments s
  WHERE s.order_id = p_order_id AND s.owner_id = p_owner_id;

  IF v_shipment IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'shipment', NULL,
      'delivery_fee', v_order.delivery_fee,
      'delivery_status', v_order.delivery_status,
      'events', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at ASC), '[]'::jsonb)
  INTO v_events
  FROM shipment_tracking_events e
  WHERE e.shipment_id = (v_shipment->>'id')::UUID;

  RETURN jsonb_build_object(
    'success', true,
    'shipment', v_shipment,
    'delivery_fee', v_order.delivery_fee,
    'delivery_status', v_order.delivery_status,
    'events', v_events
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_delivery_fee(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shipment_status(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_delivery_failed(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_failed_delivery(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_shipment(UUID, UUID) TO authenticated;
