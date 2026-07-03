-- Subscription system: yearly sync fix, indexes, extend RPC, list stale cleanup, optional cron.

-- ---------------------------------------------------------------------------
-- 1. Fix store_subscriptions sync: yearly plan must not map to free
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_store_subscription_from_sales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id TEXT;
BEGIN
  v_plan_id := CASE
    WHEN NEW.plan_name = 'yearly' THEN 'yearly'
    WHEN NEW.plan_name = 'annual' THEN 'annual'
    WHEN NEW.plan_name ILIKE '%yearly%'
      OR NEW.plan_name ILIKE '%سنو%'
      OR NEW.plan_name ILIKE '%12%'
      THEN 'yearly'
    WHEN NEW.plan_name ILIKE '%annual%'
      OR NEW.plan_name ILIKE '%6%'
      THEN 'annual'
    WHEN NEW.plan_name ILIKE '%elite%'
      OR NEW.plan_name ILIKE '%نخبة%'
      THEN 'elite'
    ELSE COALESCE(NULLIF(trim(NEW.plan_name), ''), 'free')
  END;

  INSERT INTO public.store_subscriptions (
    owner_id, plan_id, status, current_period_start, current_period_end
  )
  VALUES (
    NEW.user_id,
    v_plan_id,
    CASE NEW.status
      WHEN 'active' THEN 'active'
      WHEN 'suspended' THEN 'past_due'
      ELSE 'cancelled'
    END,
    NEW.start_date,
    NEW.end_date
  )
  ON CONFLICT (owner_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Backfill yearly merchants incorrectly synced as free
UPDATE public.store_subscriptions ss
SET plan_id = 'yearly', updated_at = NOW()
FROM public.subscriptions s
WHERE ss.owner_id = s.user_id
  AND s.plan_name = 'yearly'
  AND ss.plan_id = 'free';

UPDATE public.store_subscriptions ss
SET plan_id = 'annual', updated_at = NOW()
FROM public.subscriptions s
WHERE ss.owner_id = s.user_id
  AND s.plan_name = 'annual'
  AND ss.plan_id = 'free';

-- ---------------------------------------------------------------------------
-- 2. Indexes for expiry sweeps and lead lookups
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_merchant_access_codes_subscription_end
  ON public.merchant_access_codes (subscription_end_at)
  WHERE status = 'active' AND subscription_end_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_access_codes_code_expires
  ON public.merchant_access_codes (code_expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_lead_id
  ON public.subscriptions (lead_id)
  WHERE lead_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Date sanity (skip invalid legacy rows via NOT VALID if needed)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_end_after_start
    CHECK (end_date IS NULL OR end_date >= start_date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN check_violation THEN
    RAISE NOTICE 'subscriptions_end_after_start: fix invalid rows before enforcing';
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. List codes: expire stale before returning rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_lead_access_codes(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  PERFORM public.expire_stale_merchant_access_codes();

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      mac.id,
      mac.lead_id,
      mac.code_hint,
      mac.plan_id,
      mac.duration_months,
      mac.agreed_price,
      mac.store_name,
      mac.username,
      mac.status,
      mac.code_expires_at,
      mac.subscription_start_at,
      mac.subscription_end_at,
      mac.redeemed_at,
      mac.redeemed_user_id,
      mac.created_at
    FROM public.merchant_access_codes mac
    WHERE mac.lead_id = p_lead_id
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Admin extend / renew subscription term for a lead
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_extend_subscription(
  p_lead_id UUID,
  p_extra_months INT DEFAULT 6,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_start TIMESTAMPTZ;
  v_current_end TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_months INT;
  v_reason TEXT := COALESCE(NULLIF(trim(p_reason), ''), 'extended by admin');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT l.id, l.converted_user_id, l.full_name
  INTO v_lead
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF v_lead.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_not_found');
  END IF;

  v_months := GREATEST(COALESCE(p_extra_months, 6), 1);

  SELECT t.start_at, t.end_at
  INTO v_start, v_current_end
  FROM public._lead_subscription_term(p_lead_id) t
  LIMIT 1;

  IF v_lead.converted_user_id IS NOT NULL THEN
    SELECT s.start_date, s.end_date
    INTO v_start, v_current_end
    FROM public.subscriptions s
    WHERE s.user_id = v_lead.converted_user_id
    ORDER BY s.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_start IS NULL THEN
    v_start := NOW();
  END IF;

  v_new_end := GREATEST(COALESCE(v_current_end, NOW()), NOW()) + (v_months || ' months')::INTERVAL;

  IF v_lead.converted_user_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET
      end_date = v_new_end,
      start_date = COALESCE(start_date, v_start),
      status = 'active',
      notes = COALESCE(NULLIF(trim(notes), ''), '') ||
        CASE WHEN COALESCE(NULLIF(trim(notes), ''), '') = '' THEN '' ELSE ' | ' END ||
        v_reason,
      updated_at = NOW()
    WHERE user_id = v_lead.converted_user_id;
  END IF;

  UPDATE public.merchant_access_codes mac
  SET
    subscription_start_at = COALESCE(mac.subscription_start_at, v_start),
    subscription_end_at = v_new_end,
    code_expires_at = CASE
      WHEN mac.status = 'active' THEN v_new_end
      ELSE mac.code_expires_at
    END,
    status = CASE
      WHEN mac.status = 'expired' THEN 'expired'
      ELSE mac.status
    END,
    updated_at = NOW()
  WHERE mac.lead_id = p_lead_id;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', p_lead_id,
    'subscription_start_at', v_start,
    'subscription_end_at', v_new_end,
    'extra_months', v_months
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_extend_subscription(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_extend_subscription(UUID, INT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Hourly stale-code cleanup (pg_cron when available)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire-stale-access-codes');
    PERFORM cron.schedule(
      'expire-stale-access-codes',
      '0 * * * *',
      $cron$SELECT public.expire_stale_merchant_access_codes()$cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END;
$$;
