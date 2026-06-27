-- Merchant access codes: admin generates code after sales agreement; customer logs in with code only

CREATE TABLE IF NOT EXISTS public.merchant_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  auth_email TEXT NOT NULL UNIQUE,
  auth_password TEXT NOT NULL,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('annual', 'yearly')),
  duration_months INT NOT NULL CHECK (duration_months IN (6, 12)),
  agreed_price INTEGER,
  store_name TEXT,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed', 'expired', 'revoked')),
  code_expires_at TIMESTAMPTZ NOT NULL,
  subscription_end_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  redeemed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_access_codes_lead ON public.merchant_access_codes (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_access_codes_status ON public.merchant_access_codes (status);

ALTER TABLE public.merchant_access_codes ENABLE ROW LEVEL SECURITY;

-- No direct client access; edge functions use service role
DROP POLICY IF EXISTS merchant_access_codes_deny_all ON public.merchant_access_codes;
CREATE POLICY merchant_access_codes_deny_all ON public.merchant_access_codes
  FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.touch_merchant_access_codes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchant_access_codes_updated_at ON public.merchant_access_codes;
CREATE TRIGGER trg_merchant_access_codes_updated_at
  BEFORE UPDATE ON public.merchant_access_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_merchant_access_codes_updated_at();

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

REVOKE ALL ON FUNCTION public.admin_list_lead_access_codes(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_lead_access_codes(UUID) TO authenticated;

REVOKE ALL ON TABLE public.merchant_access_codes FROM PUBLIC;
GRANT ALL ON TABLE public.merchant_access_codes TO service_role;
