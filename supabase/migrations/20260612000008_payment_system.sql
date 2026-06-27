-- Payment system: transactions, webhooks, refunds, chargebacks, validation

-- =============================================================================
-- Order payment status
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending_collection'
    CHECK (payment_status IN (
      'pending_collection',
      'collected',
      'awaiting_gateway',
      'paid',
      'failed',
      'partially_refunded',
      'refunded',
      'disputed'
    ));

UPDATE public.orders
SET payment_status = CASE
  WHEN payment_method = 'cash_on_delivery' AND status = 'completed' THEN 'collected'
  WHEN payment_method = 'cash_on_delivery' THEN 'pending_collection'
  WHEN status = 'cancelled' THEN 'failed'
  ELSE 'pending_collection'
END
WHERE payment_status = 'pending_collection';

-- =============================================================================
-- Payment transactions ledger
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'IQD',
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed')),
  provider TEXT NOT NULL DEFAULT 'internal',
  provider_payment_id TEXT,
  idempotency_key TEXT,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_idempotency
  ON public.payment_transactions (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND trim(idempotency_key) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_payment
  ON public.payment_transactions (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL AND trim(provider_payment_id) <> '';

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON public.payment_transactions(order_id);

-- =============================================================================
-- Webhook idempotency log
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

-- =============================================================================
-- Chargebacks / disputes
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_chargebacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost', 'withdrawn')),
  reason TEXT,
  provider_dispute_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_chargebacks_order ON public.order_chargebacks(order_id);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_chargebacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_transactions_owner ON public.payment_transactions;
CREATE POLICY payment_transactions_owner ON public.payment_transactions
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS order_chargebacks_owner ON public.order_chargebacks;
CREATE POLICY order_chargebacks_owner ON public.order_chargebacks
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Webhook events: service role only (no client access)
DROP POLICY IF EXISTS payment_webhook_events_deny ON public.payment_webhook_events;
CREATE POLICY payment_webhook_events_deny ON public.payment_webhook_events
  FOR ALL USING (false);

-- =============================================================================
-- Validate payment method against store settings
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_payment_method_allowed(
  p_owner_id UUID,
  p_payment_method TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_methods JSONB;
  v_method TEXT;
BEGIN
  v_method := COALESCE(NULLIF(trim(p_payment_method), ''), 'cash_on_delivery');

  -- Online card requires gateway — block until integrated
  IF v_method = 'credit_card' THEN
    RETURN false;
  END IF;

  SELECT payment_methods INTO v_methods
  FROM store_settings
  WHERE owner_id = p_owner_id;

  IF v_methods IS NULL OR jsonb_typeof(v_methods) <> 'array' OR jsonb_array_length(v_methods) = 0 THEN
    RETURN v_method = 'cash_on_delivery';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_methods) AS m(val)
    WHERE m.val = v_method
  );
END;
$$;

-- =============================================================================
-- Create payment transaction on new order (idempotent)
-- =============================================================================

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
  IF NOT public.is_payment_method_allowed(NEW.owner_id, NEW.payment_method) THEN
    RAISE EXCEPTION 'payment_method_not_allowed: %', NEW.payment_method;
  END IF;

  IF EXISTS (SELECT 1 FROM payment_transactions WHERE order_id = NEW.id) THEN
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

  INSERT INTO payment_transactions (
    order_id, owner_id, amount, payment_method, status, provider, idempotency_key
  ) VALUES (
    NEW.id,
    NEW.owner_id,
    NEW.total_amount,
    COALESCE(NEW.payment_method, 'cash_on_delivery'),
    v_status,
    v_provider,
    NEW.idempotency_key
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

DROP TRIGGER IF EXISTS order_create_payment_transaction ON public.orders;
CREATE TRIGGER order_create_payment_transaction
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_payment_transaction_for_order();

-- =============================================================================
-- Mark COD collected when order completed
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_payment_on_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'pending' THEN
    UPDATE payment_transactions
    SET status = 'completed', updated_at = NOW()
    WHERE order_id = NEW.id AND status = 'pending';

    IF NEW.payment_method = 'cash_on_delivery' OR NEW.payment_method = 'digital_wallet' THEN
      NEW.payment_status := 'collected';
    ELSE
      NEW.payment_status := 'paid';
    END IF;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    UPDATE payment_transactions
    SET status = 'failed', failure_reason = 'order_cancelled', updated_at = NOW()
    WHERE order_id = NEW.id AND status IN ('pending', 'completed');

    NEW.payment_status := 'failed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_sync_payment_status ON public.orders;
CREATE TRIGGER order_sync_payment_status
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_payment_on_order_status();

-- =============================================================================
-- Improved refund with cumulative cap + duplicate protection
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_order_refund(
  p_order_id UUID,
  p_owner_id UUID,
  p_amount DECIMAL,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_refund_id UUID;
  v_refunded_total DECIMAL;
  v_existing UUID;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existing
    FROM order_refunds
    WHERE order_id = p_order_id
      AND owner_id = p_owner_id
      AND metadata->>'idempotency_key' = trim(p_idempotency_key)
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'refund_id', v_existing, 'idempotent', true);
    END IF;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND owner_id = p_owner_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refunds only allowed for completed orders');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid refund amount');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_refunded_total
  FROM order_refunds
  WHERE order_id = p_order_id AND owner_id = p_owner_id AND status = 'completed';

  IF v_refunded_total + p_amount > v_order.total_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Refund exceeds remaining balance',
      'remaining', v_order.total_amount - v_refunded_total
    );
  END IF;

  INSERT INTO order_refunds (order_id, owner_id, amount, status, reason, metadata)
  VALUES (
    p_order_id,
    p_owner_id,
    p_amount,
    'completed',
    p_reason,
    CASE
      WHEN p_idempotency_key IS NOT NULL THEN jsonb_build_object('idempotency_key', trim(p_idempotency_key))
      ELSE '{}'::jsonb
    END
  )
  RETURNING id INTO v_refund_id;

  UPDATE payment_transactions
  SET status = 'refunded', updated_at = NOW()
  WHERE order_id = p_order_id AND owner_id = p_owner_id;

  UPDATE orders
  SET payment_status = CASE
    WHEN v_refunded_total + p_amount >= v_order.total_amount THEN 'refunded'
    ELSE 'partially_refunded'
  END,
  updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add metadata to order_refunds if missing
ALTER TABLE public.order_refunds
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- =============================================================================
-- Payment summary for order details
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_order_payment_summary(p_order_id UUID, p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_transactions JSONB;
  v_refunds JSONB;
  v_chargebacks JSONB;
  v_refunded_total DECIMAL;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT id, total_amount, payment_method, payment_status, status
  INTO v_order
  FROM orders
  WHERE id = p_order_id AND owner_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_transactions
  FROM payment_transactions t
  WHERE t.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_refunds
  FROM order_refunds r
  WHERE r.order_id = p_order_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_chargebacks
  FROM order_chargebacks c
  WHERE c.order_id = p_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_refunded_total
  FROM order_refunds
  WHERE order_id = p_order_id AND status = 'completed';

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'total_amount', v_order.total_amount,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'order_status', v_order.status,
    'refunded_total', v_refunded_total,
    'remaining_refundable', GREATEST(v_order.total_amount - v_refunded_total, 0),
    'transactions', v_transactions,
    'refunds', v_refunds,
    'chargebacks', v_chargebacks
  );
END;
$$;

-- =============================================================================
-- Record chargeback (merchant)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_order_chargeback(
  p_order_id UUID,
  p_owner_id UUID,
  p_amount DECIMAL,
  p_reason TEXT DEFAULT NULL,
  p_provider_dispute_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_cb_id UUID;
  v_tx_id UUID;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND owner_id = p_owner_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  SELECT id INTO v_tx_id
  FROM payment_transactions
  WHERE order_id = p_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO order_chargebacks (order_id, owner_id, payment_transaction_id, amount, status, reason, provider_dispute_id)
  VALUES (p_order_id, p_owner_id, v_tx_id, p_amount, 'open', p_reason, p_provider_dispute_id)
  RETURNING id INTO v_cb_id;

  UPDATE orders SET payment_status = 'disputed', updated_at = NOW() WHERE id = p_order_id;

  UPDATE payment_transactions
  SET status = 'disputed', updated_at = NOW()
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object('success', true, 'chargeback_id', v_cb_id);
END;
$$;

-- =============================================================================
-- Process webhook event (idempotent) — called from edge function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_payment_webhook_event(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing TIMESTAMPTZ;
BEGIN
  SELECT processed_at INTO v_existing
  FROM payment_webhook_events
  WHERE provider = p_provider AND event_id = p_event_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  INSERT INTO payment_webhook_events (provider, event_id, event_type, payload, processed_at)
  VALUES (p_provider, p_event_id, p_event_type, p_payload, NOW())
  ON CONFLICT (provider, event_id) DO NOTHING;

  -- Gateway-specific handling stub (extend when Stripe/etc. added)
  RETURN jsonb_build_object('success', true, 'processed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_payment_method_allowed(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_payment_summary(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_chargeback(UUID, UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook_event(TEXT, TEXT, TEXT, JSONB) TO service_role;
