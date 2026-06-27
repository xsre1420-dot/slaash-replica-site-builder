-- Extended lead filters: pipeline stats, today, customers

CREATE OR REPLACE FUNCTION public.admin_leads_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW() AT TIME ZONE 'Asia/Baghdad');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total', (SELECT COUNT(*) FROM public.leads),
    'new_count', (SELECT COUNT(*) FROM public.leads WHERE status = 'new'),
    'unread_count', (
      SELECT COUNT(*) FROM public.leads
      WHERE admin_read_at IS NULL AND status = 'new'
    ),
    'needs_code_count', (
      SELECT COUNT(*) FROM public.leads l
      WHERE l.converted_user_id IS NULL
        AND l.status NOT IN ('rejected')
        AND NOT EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = l.id AND mac.status = 'active'
        )
    ),
    'pending_activation_count', (
      SELECT COUNT(*) FROM public.leads l
      WHERE l.converted_user_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = l.id AND mac.status = 'active'
        )
    ),
    'pipeline_count', (
      SELECT COUNT(*) FROM public.leads
      WHERE status IN ('new', 'contacted', 'interested')
    ),
    'customer_count', (
      SELECT COUNT(*) FROM public.leads
      WHERE status = 'customer' OR converted_user_id IS NOT NULL
    ),
    'today_count', (
      SELECT COUNT(*) FROM public.leads
      WHERE created_at >= v_today_start
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_leads(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_filter TEXT DEFAULT NULL,
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
  v_filter TEXT := NULLIF(trim(COALESCE(p_filter, '')), '');
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW() AT TIME ZONE 'Asia/Baghdad');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.leads l
  WHERE (p_status IS NULL OR trim(p_status) = '' OR l.status = p_status)
    AND (
      p_search IS NULL OR trim(p_search) = ''
      OR l.full_name ILIKE '%' || trim(p_search) || '%'
      OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
      OR COALESCE(l.selected_plan_name, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(l.governorate, '') ILIKE '%' || trim(p_search) || '%'
    )
    AND (
      v_filter IS NULL
      OR (v_filter = 'unread' AND l.admin_read_at IS NULL AND l.status = 'new')
      OR (
        v_filter = 'needs_code'
        AND l.converted_user_id IS NULL
        AND l.status <> 'rejected'
        AND NOT EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = l.id AND mac.status = 'active'
        )
      )
      OR (
        v_filter = 'pending_activation'
        AND l.converted_user_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.merchant_access_codes mac
          WHERE mac.lead_id = l.id AND mac.status = 'active'
        )
      )
      OR (v_filter = 'pipeline' AND l.status IN ('new', 'contacted', 'interested'))
      OR (v_filter = 'customers' AND (l.status = 'customer' OR l.converted_user_id IS NOT NULL))
      OR (v_filter = 'today' AND l.created_at >= v_today_start)
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
      (l.admin_read_at IS NULL AND l.status = 'new') AS is_unread,
      EXISTS (
        SELECT 1 FROM public.merchant_access_codes mac
        WHERE mac.lead_id = l.id AND mac.status = 'active'
      ) AS has_pending_code
    FROM public.leads l
    WHERE (p_status IS NULL OR trim(p_status) = '' OR l.status = p_status)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR l.full_name ILIKE '%' || trim(p_search) || '%'
        OR l.whatsapp_number ILIKE '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
        OR COALESCE(l.selected_plan_name, '') ILIKE '%' || trim(p_search) || '%'
        OR COALESCE(l.governorate, '') ILIKE '%' || trim(p_search) || '%'
      )
      AND (
        v_filter IS NULL
        OR (v_filter = 'unread' AND l.admin_read_at IS NULL AND l.status = 'new')
        OR (
          v_filter = 'needs_code'
          AND l.converted_user_id IS NULL
          AND l.status <> 'rejected'
          AND NOT EXISTS (
            SELECT 1 FROM public.merchant_access_codes mac
            WHERE mac.lead_id = l.id AND mac.status = 'active'
          )
        )
        OR (
          v_filter = 'pending_activation'
          AND l.converted_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.merchant_access_codes mac
            WHERE mac.lead_id = l.id AND mac.status = 'active'
          )
        )
        OR (v_filter = 'pipeline' AND l.status IN ('new', 'contacted', 'interested'))
        OR (v_filter = 'customers' AND (l.status = 'customer' OR l.converted_user_id IS NOT NULL))
        OR (v_filter = 'today' AND l.created_at >= v_today_start)
      )
    ORDER BY
      CASE WHEN l.admin_read_at IS NULL AND l.status = 'new' THEN 0 ELSE 1 END,
      l.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows, 'total', v_total);
END;
$$;
