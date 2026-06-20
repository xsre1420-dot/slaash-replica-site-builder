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
