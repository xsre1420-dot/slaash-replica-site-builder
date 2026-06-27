-- Slaash Leads Flow Bundle
-- Paste in Supabase SQL Editor

-- -- 20260621000001_leads_subscription_sales_flow.sql --
-- Lead-generation sales flow: leads, platform admins, merchant subscriptions, access gate

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'interested', 'customer', 'rejected')),
  source TEXT NOT NULL DEFAULT 'website',
  notes TEXT,
  admin_read_at TIMESTAMPTZ,
  converted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status_created ON public.leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON public.leads (whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_leads_unread ON public.leads (created_at DESC)
  WHERE admin_read_at IS NULL AND status = 'new';

-- ---------------------------------------------------------------------------
-- Platform admins (sales / ops team)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Merchant subscriptions (sales-assigned access)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'standard',
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'suspended')),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON public.subscriptions (end_date)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = COALESCE(p_user_id, auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_number(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  v_digits := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;
  IF v_digits LIKE '964%' THEN
    RETURN v_digits;
  END IF;
  IF v_digits LIKE '0%' THEN
    v_digits := '964' || ltrim(v_digits, '0');
  ELSIF length(v_digits) <= 10 THEN
    v_digits := '964' || v_digits;
  END IF;
  RETURN v_digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = COALESCE(p_user_id, auth.uid())
      AND s.status = 'active'
      AND (s.end_date IS NULL OR s.end_date >= NOW())
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_leads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_leads_updated_at();

CREATE OR REPLACE FUNCTION public.touch_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_subscriptions_updated_at();

-- Sync legacy store_subscriptions when sales subscription changes
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
    WHEN NEW.plan_name ILIKE '%annual%' OR NEW.plan_name ILIKE '%6%' THEN 'annual'
    WHEN NEW.plan_name ILIKE '%elite%' OR NEW.plan_name ILIKE '%نخبة%' THEN 'elite'
    ELSE 'free'
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

DROP TRIGGER IF EXISTS trg_sync_store_subscription_from_sales ON public.subscriptions;
CREATE TRIGGER trg_sync_store_subscription_from_sales
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_store_subscription_from_sales();

-- ---------------------------------------------------------------------------
-- Public lead capture (no auth account)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_access_lead(
  p_full_name TEXT,
  p_whatsapp_number TEXT,
  p_source TEXT DEFAULT 'website'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_lead_id UUID;
BEGIN
  v_name := trim(COALESCE(p_full_name, ''));
  v_phone := public.normalize_whatsapp_number(p_whatsapp_number);

  IF length(v_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_name');
  END IF;
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_whatsapp');
  END IF;

  INSERT INTO public.leads (full_name, whatsapp_number, source, status)
  VALUES (v_name, v_phone, COALESCE(NULLIF(trim(p_source), ''), 'website'), 'new')
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin lead management RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_leads(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.leads l
  WHERE (p_status IS NULL OR l.status = p_status)
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR l.full_name ILIKE '%' || trim(p_search) || '%'
      OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      l.id,
      l.full_name,
      l.whatsapp_number,
      l.status,
      l.source,
      l.notes,
      l.admin_read_at,
      l.converted_user_id,
      l.converted_at,
      l.created_at,
      l.updated_at,
      (l.admin_read_at IS NULL AND l.status = 'new') AS is_unread
    FROM public.leads l
    WHERE (p_status IS NULL OR l.status = p_status)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR l.full_name ILIKE '%' || trim(p_search) || '%'
        OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
      )
    ORDER BY l.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_lead(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT to_jsonb(l) INTO v_lead
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'lead', v_lead);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_lead(
  p_lead_id UUID,
  p_status TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_mark_read BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.leads
  SET
    status = COALESCE(NULLIF(trim(p_status), ''), status),
    notes = CASE WHEN p_notes IS NOT NULL THEN p_notes ELSE notes END,
    admin_read_at = CASE
      WHEN p_mark_read IS TRUE THEN NOW()
      WHEN p_mark_read IS FALSE THEN NULL
      ELSE admin_read_at
    END
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unread_leads_count()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM public.leads l
  WHERE public.is_platform_admin()
    AND l.admin_read_at IS NULL
    AND l.status = 'new';
$$;

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.subscriptions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE (p_status IS NULL OR s.status = p_status)
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR s.plan_name ILIKE '%' || trim(p_search) || '%'
      OR p.username ILIKE '%' || trim(p_search) || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      s.id,
      s.user_id,
      s.plan_name,
      s.start_date,
      s.end_date,
      s.status,
      s.lead_id,
      s.converted_at,
      s.notes,
      s.created_at,
      p.username,
      p.store_name
    FROM public.subscriptions s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE (p_status IS NULL OR s.status = p_status)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR s.plan_name ILIKE '%' || trim(p_search) || '%'
        OR p.username ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY s.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_subscription(
  p_user_id UUID,
  p_plan_name TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NOW(),
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  INSERT INTO public.subscriptions (
    user_id, plan_name, start_date, end_date, status, notes
  )
  VALUES (
    p_user_id,
    COALESCE(NULLIF(trim(p_plan_name), ''), 'standard'),
    COALESCE(p_start_date, NOW()),
    p_end_date,
    COALESCE(NULLIF(trim(p_status), ''), 'active'),
    p_notes
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_name = EXCLUDED.plan_name,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    status = EXCLUDED.status,
    notes = COALESCE(EXCLUDED.notes, subscriptions.notes),
    updated_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', true, 'is_admin', true, 'has_access', true);
  END IF;

  SELECT to_jsonb(s) INTO v_sub
  FROM public.subscriptions s
  WHERE s.user_id = auth.uid()
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'subscription', v_sub,
    'has_access', public.has_active_subscription(auth.uid())
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage leads" ON public.leads;
CREATE POLICY "Platform admins manage leads"
  ON public.leads FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;
CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Platform admins manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Admins read platform_admins" ON public.platform_admins;
CREATE POLICY "Admins read platform_admins"
  ON public.platform_admins FOR SELECT
  USING (public.is_platform_admin() OR auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_my_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;

REVOKE ALL ON FUNCTION public.has_active_subscription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_leads(TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_leads(TEXT, TEXT, INT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_get_lead(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_lead(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_lead(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_lead(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_unread_leads_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unread_leads_count() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_subscriptions(TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(TEXT, TEXT, INT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_upsert_subscription(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_subscription(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- Backfill subscriptions for existing merchants (no data loss)
INSERT INTO public.subscriptions (user_id, plan_name, start_date, end_date, status)
SELECT
  ss.owner_id,
  COALESCE(sp.name, ss.plan_id, 'standard'),
  COALESCE(ss.current_period_start, ss.created_at, NOW()),
  ss.current_period_end,
  CASE
    WHEN ss.status = 'active' THEN 'active'
    WHEN ss.status IN ('trialing', 'past_due') THEN 'active'
    WHEN ss.status = 'cancelled' THEN 'expired'
    ELSE 'suspended'
  END
FROM public.store_subscriptions ss
LEFT JOIN public.subscription_plans sp ON sp.id = ss.plan_id
ON CONFLICT (user_id) DO NOTHING;


-- -- 20260622000001_leads_selected_plan.sql --
-- Store selected subscription plan on access leads

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS selected_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS selected_plan_name TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_selected_plan ON public.leads (selected_plan_id)
  WHERE selected_plan_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_access_lead(
  p_full_name TEXT,
  p_whatsapp_number TEXT,
  p_source TEXT DEFAULT 'website',
  p_selected_plan_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_lead_id UUID;
  v_plan_id TEXT;
  v_plan_name TEXT;
BEGIN
  v_name := trim(COALESCE(p_full_name, ''));
  v_phone := public.normalize_whatsapp_number(p_whatsapp_number);
  v_plan_id := NULLIF(trim(COALESCE(p_selected_plan_id, '')), '');

  IF length(v_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_name');
  END IF;
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_whatsapp');
  END IF;

  IF v_plan_id IS NOT NULL THEN
    SELECT sp.name INTO v_plan_name
    FROM public.subscription_plans sp
    WHERE sp.id = v_plan_id AND sp.is_active = true;

    IF v_plan_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
    END IF;
  END IF;

  INSERT INTO public.leads (
    full_name,
    whatsapp_number,
    source,
    status,
    selected_plan_id,
    selected_plan_name
  )
  VALUES (
    v_name,
    v_phone,
    COALESCE(NULLIF(trim(p_source), ''), 'website'),
    'new',
    v_plan_id,
    v_plan_name
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_leads(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.leads l
  WHERE (p_status IS NULL OR l.status = p_status)
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR l.full_name ILIKE '%' || trim(p_search) || '%'
      OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
      OR COALESCE(l.selected_plan_name, '') ILIKE '%' || trim(p_search) || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      l.id,
      l.full_name,
      l.whatsapp_number,
      l.status,
      l.source,
      l.notes,
      l.selected_plan_id,
      l.selected_plan_name,
      l.admin_read_at,
      l.converted_user_id,
      l.converted_at,
      l.created_at,
      l.updated_at,
      (l.admin_read_at IS NULL AND l.status = 'new') AS is_unread
    FROM public.leads l
    WHERE (p_status IS NULL OR l.status = p_status)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR l.full_name ILIKE '%' || trim(p_search) || '%'
        OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
        OR COALESCE(l.selected_plan_name, '') ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY l.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- -- 20260622000002_yearly_subscription_plan.sql --
-- Add yearly subscription plan for public pricing toggle

INSERT INTO public.subscription_plans (id, name, price_amount, billing_interval_months, features)
VALUES
  ('yearly', 'باقة سنوية', 220000, 12, '{"max_products": -1, "custom_domain": true, "unlimited_orders": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_amount = EXCLUDED.price_amount,
  billing_interval_months = EXCLUDED.billing_interval_months,
  features = EXCLUDED.features,
  is_active = true;

UPDATE public.subscription_plans
SET
  name = 'باقة 6 أشهر',
  price_amount = 125000,
  billing_interval_months = 6,
  is_active = true
WHERE id = 'annual';


-- -- 20260622000003_leads_extended_fields.sql --
-- Extended lead capture fields: governorate, Instagram, expected monthly orders

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS expected_monthly_orders TEXT;

CREATE OR REPLACE FUNCTION public.submit_access_lead(
  p_full_name TEXT,
  p_whatsapp_number TEXT,
  p_source TEXT DEFAULT 'website',
  p_selected_plan_id TEXT DEFAULT NULL,
  p_governorate TEXT DEFAULT NULL,
  p_instagram_url TEXT DEFAULT NULL,
  p_expected_monthly_orders TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_lead_id UUID;
  v_plan_id TEXT;
  v_plan_name TEXT;
  v_governorate TEXT;
  v_instagram TEXT;
  v_orders TEXT;
BEGIN
  v_name := trim(COALESCE(p_full_name, ''));
  v_phone := public.normalize_whatsapp_number(p_whatsapp_number);
  v_plan_id := NULLIF(trim(COALESCE(p_selected_plan_id, '')), '');
  v_governorate := NULLIF(trim(COALESCE(p_governorate, '')), '');
  v_instagram := NULLIF(trim(COALESCE(p_instagram_url, '')), '');
  v_orders := NULLIF(trim(COALESCE(p_expected_monthly_orders, '')), '');

  IF length(v_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_name');
  END IF;
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_whatsapp');
  END IF;
  IF v_governorate IS NULL OR length(v_governorate) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_governorate');
  END IF;
  IF v_orders IS NULL OR length(v_orders) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_monthly_orders');
  END IF;

  IF v_plan_id IS NOT NULL THEN
    SELECT sp.name INTO v_plan_name
    FROM public.subscription_plans sp
    WHERE sp.id = v_plan_id AND sp.is_active = true;

    IF v_plan_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
    END IF;
  END IF;

  INSERT INTO public.leads (
    full_name,
    whatsapp_number,
    source,
    status,
    selected_plan_id,
    selected_plan_name,
    governorate,
    instagram_url,
    expected_monthly_orders
  )
  VALUES (
    v_name,
    v_phone,
    COALESCE(NULLIF(trim(p_source), ''), 'website'),
    'new',
    v_plan_id,
    v_plan_name,
    v_governorate,
    v_instagram,
    v_orders
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_leads(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.leads l
  WHERE (p_status IS NULL OR l.status = p_status)
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR l.full_name ILIKE '%' || trim(p_search) || '%'
      OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
      OR COALESCE(l.selected_plan_name, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(l.governorate, '') ILIKE '%' || trim(p_search) || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      l.id,
      l.full_name,
      l.whatsapp_number,
      l.status,
      l.source,
      l.notes,
      l.selected_plan_id,
      l.selected_plan_name,
      l.governorate,
      l.instagram_url,
      l.expected_monthly_orders,
      l.admin_read_at,
      l.converted_user_id,
      l.converted_at,
      l.created_at,
      l.updated_at,
      (l.admin_read_at IS NULL AND l.status = 'new') AS is_unread
    FROM public.leads l
    WHERE (p_status IS NULL OR l.status = p_status)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR l.full_name ILIKE '%' || trim(p_search) || '%'
        OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
        OR COALESCE(l.selected_plan_name, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(l.governorate, '') ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY l.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- -- 20260622000004_leads_submit_complete.sql --
-- Complete lead capture: plan + contact + project fields (idempotent)

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS selected_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS selected_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS expected_monthly_orders TEXT;

-- Remove legacy overloads so PostgREST always hits the full signature
DROP FUNCTION IF EXISTS public.submit_access_lead(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_access_lead(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_access_lead(
  p_full_name TEXT,
  p_whatsapp_number TEXT,
  p_source TEXT DEFAULT 'website',
  p_selected_plan_id TEXT DEFAULT NULL,
  p_governorate TEXT DEFAULT NULL,
  p_instagram_url TEXT DEFAULT NULL,
  p_expected_monthly_orders TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_lead_id UUID;
  v_plan_id TEXT;
  v_plan_name TEXT;
  v_governorate TEXT;
  v_instagram TEXT;
  v_orders TEXT;
BEGIN
  v_name := trim(COALESCE(p_full_name, ''));
  v_phone := public.normalize_whatsapp_number(p_whatsapp_number);
  v_plan_id := NULLIF(trim(COALESCE(p_selected_plan_id, '')), '');
  v_governorate := NULLIF(trim(COALESCE(p_governorate, '')), '');
  v_instagram := NULLIF(trim(COALESCE(p_instagram_url, '')), '');
  v_orders := NULLIF(trim(COALESCE(p_expected_monthly_orders, '')), '');

  IF length(v_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_name');
  END IF;
  IF v_phone IS NULL OR length(v_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_whatsapp');
  END IF;
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;
  IF v_governorate IS NULL OR length(v_governorate) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_governorate');
  END IF;
  IF v_orders IS NULL OR length(v_orders) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_monthly_orders');
  END IF;

  SELECT sp.name INTO v_plan_name
  FROM public.subscription_plans sp
  WHERE sp.id = v_plan_id AND sp.is_active = true;

  IF v_plan_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_plan');
  END IF;

  INSERT INTO public.leads (
    full_name,
    whatsapp_number,
    source,
    status,
    selected_plan_id,
    selected_plan_name,
    governorate,
    instagram_url,
    expected_monthly_orders
  )
  VALUES (
    v_name,
    v_phone,
    COALESCE(NULLIF(trim(p_source), ''), 'website'),
    'new',
    v_plan_id,
    v_plan_name,
    v_governorate,
    v_instagram,
    v_orders
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_access_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- -- 20260622000005_platform_health_check_v12_leads.sql --
-- Health check v12: verify leads capture schema + submit_access_lead RPC

INSERT INTO public.platform_schema_version (version, notes)
VALUES (12, 'Leads table extended fields + submit_access_lead 7-arg RPC')
ON CONFLICT (version) DO UPDATE
SET applied_at = NOW(), notes = EXCLUDED.notes;

DROP FUNCTION IF EXISTS public.platform_health_check();

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 12;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_store_products_page',
    'get_store_products_by_slug',
    'get_store_product_by_id',
    'get_store_meta',
    'get_owner_products_page',
    'create_order_with_stock_deduction',
    'resolve_checkout_owner',
    'publish_owner_product',
    'get_merchant_product_reviews',
    'submit_product_review_for_store',
    'product_checkout_available_qty',
    'get_store_statistics',
    'get_owner_bootstrap',
    'attach_order_marketing_attribution',
    'list_merchant_orders',
    'count_merchant_orders_by_workflow',
    'get_storefront_footer_products',
    'submit_access_lead',
    'admin_list_leads',
    'admin_get_lead'
  ];
  v_required_cols TEXT[] := ARRAY[
    'products.archived_at',
    'products.is_active',
    'products.variants',
    'products.stock_quantity',
    'products.store_id',
    'orders.idempotency_key',
    'orders.payment_status',
    'orders.delivery_status',
    'orders.store_id',
    'store_settings.store_slug',
    'order_items.owner_id',
    'leads.selected_plan_id',
    'leads.selected_plan_name',
    'leads.governorate',
    'leads.instagram_url',
    'leads.expected_monthly_orders'
  ];
  v_col TEXT;
  v_table TEXT;
  v_column TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

  IF NOT public._platform_table_exists('leads') THEN
    v_missing := array_append(v_missing, 'table:leads');
  END IF;

  FOREACH v_fn IN ARRAY v_required_fns LOOP
    IF NOT public._platform_fn_exists(v_fn) THEN
      v_missing := array_append(v_missing, 'function:' || v_fn);
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY v_required_cols LOOP
    v_table := split_part(v_col, '.', 1);
    v_column := split_part(v_col, '.', 2);
    IF NOT public._platform_col_exists(v_table, v_column) THEN
      v_missing := array_append(v_missing, 'column:' || v_col);
    END IF;
  END LOOP;

  IF NOT public._platform_table_exists('stores') THEN
    v_missing := array_append(v_missing, 'table:stores');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images') THEN
    v_missing := array_append(v_missing, 'storage:product-images');
  END IF;

  RETURN jsonb_build_object(
    'ok', COALESCE(array_length(v_missing, 1), 0) = 0 AND v_version >= v_required,
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(to_jsonb(v_missing), '[]'::jsonb),
    'checks', jsonb_build_object(
      'storefront', public._platform_fn_exists('get_store_products_page'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction'),
      'merchant_catalog', public._platform_fn_exists('get_owner_products_page'),
      'merchant_orders', public._platform_fn_exists('list_merchant_orders'),
      'publish', public._platform_fn_exists('publish_owner_product'),
      'reviews', public._platform_fn_exists('get_merchant_product_reviews'),
      'statistics', public._platform_fn_exists('get_store_statistics'),
      'leads_submit', public._platform_fn_exists('submit_access_lead'),
      'leads_admin', public._platform_fn_exists('admin_list_leads')
    ),
    'message', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
      WHEN v_version < v_required THEN 'schema_version_outdated'
      ELSE 'ok'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO anon, authenticated, service_role;

