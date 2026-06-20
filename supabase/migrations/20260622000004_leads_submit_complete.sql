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
