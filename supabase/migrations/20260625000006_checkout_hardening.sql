-- Checkout hardening: order recovery by idempotency, webhook deduplication

-- ---------------------------------------------------------------------------
-- 1) Recover existing order after network failure / duplicate submit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_by_idempotency_key(
  p_idempotency_key TEXT,
  p_owner_id UUID DEFAULT NULL,
  p_store_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_order RECORD;
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_owner_id := p_owner_id;

  IF v_owner_id IS NULL AND p_store_slug IS NOT NULL AND trim(p_store_slug) <> '' THEN
    BEGIN
      v_owner_id := public.resolve_checkout_owner(NULL, trim(p_store_slug));
    EXCEPTION WHEN OTHERS THEN
      v_owner_id := NULL;
    END;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT o.id, o.total_amount, o.status, o.created_at
  INTO v_order
  FROM public.orders o
  WHERE o.owner_id = v_owner_id
    AND o.idempotency_key = trim(p_idempotency_key)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'order_id', v_order.id,
    'total_amount', v_order.total_amount,
    'status', v_order.status,
    'created_at', v_order.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_idempotency_key(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_idempotency_key(TEXT, UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Prevent duplicate merchant notifications per order
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_webhook_outbox_order_created_unique
  ON public.order_webhook_outbox (order_id, event_type)
  WHERE event_type = 'order.created';

CREATE OR REPLACE FUNCTION public.enqueue_order_webhook_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_webhook_outbox (
    owner_id,
    store_id,
    order_id,
    event_type,
    payload
  ) VALUES (
    NEW.owner_id,
    NEW.store_id,
    NEW.id,
    'order.created',
    jsonb_build_object(
      'order_id', NEW.id,
      'owner_id', NEW.owner_id,
      'store_id', NEW.store_id,
      'status', NEW.status,
      'total_amount', NEW.total_amount,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'created_at', NEW.created_at
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (16, 'checkout_hardening: idempotency recovery RPC, webhook dedup')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
