-- E-commerce business logic: subscriptions, returns/refunds, order status guards, discount expiry

-- =============================================================================
-- Subscription plans & store subscriptions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  billing_interval_months INT NOT NULL DEFAULT 1,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_plans (id, name, price_amount, billing_interval_months, features)
VALUES
  ('free', 'مجاني', 0, 1, '{"max_products": 50}'::jsonb),
  ('elite', 'باقة النخبة', 50000, 1, '{"max_products": 500, "custom_domain": true}'::jsonb),
  ('annual', 'باقة 6 أشهر', 125000, 6, '{"max_products": 500, "custom_domain": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_owner ON public.store_subscriptions(owner_id);
CREATE INDEX IF NOT EXISTS idx_store_subscriptions_status ON public.store_subscriptions(status);

ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_subscriptions_owner_select ON public.store_subscriptions;
CREATE POLICY store_subscriptions_owner_select ON public.store_subscriptions
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS store_subscriptions_owner_update ON public.store_subscriptions;
CREATE POLICY store_subscriptions_owner_update ON public.store_subscriptions
  FOR UPDATE USING (owner_id = auth.uid());

-- =============================================================================
-- Returns & refunds (COD merchant-recorded)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'received', 'rejected', 'refunded')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_returns_order ON public.order_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_order ON public.order_refunds(order_id);

ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_returns_owner ON public.order_returns;
CREATE POLICY order_returns_owner ON public.order_returns
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS order_refunds_owner ON public.order_refunds;
CREATE POLICY order_refunds_owner ON public.order_refunds
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- =============================================================================
-- Order status transition guard
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('completed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid_status_transition: cannot change from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS order_status_transition_guard ON public.orders;
CREATE TRIGGER order_status_transition_guard
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();

-- =============================================================================
-- Auto-expire product discounts
-- =============================================================================

CREATE OR REPLACE FUNCTION public.expire_product_discounts()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.products
  SET
    price = COALESCE(original_price, price),
    discount_type = 'none',
    discount_value = 0,
    original_price = NULL,
    discount_start_date = NULL,
    discount_end_date = NULL,
    updated_at = NOW()
  WHERE discount_type IS NOT NULL
    AND discount_type <> 'none'
    AND discount_end_date IS NOT NULL
    AND discount_end_date < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- Provision subscription on signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id TEXT;
  v_interval INT;
BEGIN
  INSERT INTO public.profiles (id, username, store_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'store_name', 'متجري')
  );

  v_plan_id := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'selected_plan'), ''), 'free');

  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = v_plan_id) THEN
    v_plan_id := 'free';
  END IF;

  SELECT billing_interval_months INTO v_interval
  FROM public.subscription_plans WHERE id = v_plan_id;

  INSERT INTO public.store_subscriptions (
    owner_id, plan_id, status, current_period_start, current_period_end
  ) VALUES (
    NEW.id,
    v_plan_id,
    'trialing',
    NOW(),
    NOW() + (COALESCE(v_interval, 1) || ' months')::INTERVAL
  )
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- RPC: record refund (merchant COD)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_order_refund(
  p_order_id UUID,
  p_owner_id UUID,
  p_amount DECIMAL,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_refund_id UUID;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND owner_id = p_owner_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refunds only allowed for completed orders');
  END IF;

  IF p_amount <= 0 OR p_amount > v_order.total_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid refund amount');
  END IF;

  INSERT INTO order_refunds (order_id, owner_id, amount, status, reason)
  VALUES (p_order_id, p_owner_id, p_amount, 'completed', p_reason)
  RETURNING id INTO v_refund_id;

  RETURN jsonb_build_object('success', true, 'refund_id', v_refund_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_order_refund TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_product_discounts TO authenticated;
