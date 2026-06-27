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
