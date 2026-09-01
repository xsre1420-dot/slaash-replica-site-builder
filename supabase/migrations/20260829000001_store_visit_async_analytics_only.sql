-- v103: Remove synchronous analytics buffer flush from storefront visit hot path.
-- Events remain in analytics_event_outbox; processing continues via pg_cron + merchant flush RPC.

CREATE OR REPLACE FUNCTION public.track_store_visit_by_slug(
  p_store_slug TEXT,
  p_page_path TEXT DEFAULT '/',
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_ip TEXT;
  v_path TEXT;
BEGIN
  IF p_store_slug IS NULL OR trim(p_store_slug) = '' OR p_store_slug !~ '^[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slug');
  END IF;

  v_owner := public._resolve_store_owner_by_slug(p_store_slug);
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(current_setting('request.headers', true)::json->>'x-real-ip', ''),
    '0.0.0.0'
  );

  v_path := COALESCE(NULLIF(trim(p_page_path), ''), '/');

  IF EXISTS (
    SELECT 1
    FROM public.store_visits sv
    WHERE sv.owner_id = v_owner
      AND sv.visitor_ip = v_ip
      AND sv.page_path = v_path
      AND sv.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM public.analytics_event_outbox o
    WHERE o.owner_id = v_owner
      AND o.event_type = 'store_visit'
      AND o.payload->>'visitor_ip' = v_ip
      AND o.payload->>'page_path' = v_path
      AND o.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  IF NOT public.is_valid_store_visit(v_owner, v_ip) THEN
    RETURN jsonb_build_object('success', true, 'rate_limited', true);
  END IF;

  INSERT INTO public.analytics_event_outbox (owner_id, event_type, payload)
  VALUES (
    v_owner,
    'store_visit',
    jsonb_build_object(
      'visitor_ip', v_ip,
      'page_path', v_path,
      'user_agent', LEFT(p_user_agent, 512),
      'store_slug', lower(trim(p_store_slug))
    )
  );

  RETURN jsonb_build_object('success', true, 'buffered', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_store_visit_by_slug(TEXT, TEXT, TEXT) TO anon, authenticated;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (103, 'store_visit hot path: remove synchronous process_analytics_event_buffer — async via pg_cron only')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
