-- v97: Performance regression fix — restore analytics outbox dedupe indexes lost in v70/v71 partition conversion
-- Root cause: track_store_visit_by_slug / track_product_view_by_slug dedupe EXISTS scans became sequential
-- on partitioned analytics_event_outbox after idx_analytics_event_outbox_*_dedupe were not recreated.

-- ---------------------------------------------------------------------------
-- 1) Restore hot-path dedupe indexes (propagate to all partitions)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_visit_dedupe
  ON public.analytics_event_outbox (
    owner_id,
    event_type,
    ((payload->>'visitor_ip')),
    ((payload->>'page_path')),
    created_at DESC
  )
  WHERE event_type = 'store_visit';

CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_product_dedupe
  ON public.analytics_event_outbox (
    owner_id,
    event_type,
    ((payload->>'product_id')),
    ((payload->>'visitor_ip')),
    created_at DESC
  )
  WHERE event_type = 'product_view';

-- Owner + time slice for partition-pruned recent-window lookups
CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_owner_type_created
  ON public.analytics_event_outbox (owner_id, event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2) Visit tracking — indexed store_visits check first, then outbox (same semantics)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3) Product view tracking — store_visits table check first (product_views indexed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_product_view_by_slug(
  p_slug TEXT,
  p_product_id UUID,
  p_page_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_ip TEXT;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]+$' OR p_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  SELECT ss.owner_id INTO v_owner_id
  FROM store_settings ss
  WHERE LOWER(ss.store_slug) = LOWER(trim(p_slug))
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT st.user_id INTO v_owner_id
    FROM stores st
    WHERE LOWER(st.store_slug) = LOWER(trim(p_slug))
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'store_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = p_product_id
      AND p.owner_id = v_owner_id
      AND COALESCE(p.is_active, true) = true
      AND p.archived_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'product_not_found');
  END IF;

  v_ip := COALESCE(
    NULLIF(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    '0.0.0.0'
  );

  IF EXISTS (
    SELECT 1
    FROM public.product_views pv
    WHERE pv.owner_id = v_owner_id
      AND pv.product_id = p_product_id
      AND pv.visitor_ip = v_ip
      AND pv.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM public.analytics_event_outbox o
    WHERE o.owner_id = v_owner_id
      AND o.event_type = 'product_view'
      AND o.payload->>'product_id' = p_product_id::TEXT
      AND o.payload->>'visitor_ip' = v_ip
      AND o.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('success', true, 'deduped', true);
  END IF;

  IF NOT public.is_valid_product_view(v_owner_id, p_product_id, v_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.analytics_event_outbox (owner_id, event_type, payload)
  VALUES (
    v_owner_id,
    'product_view',
    jsonb_build_object(
      'product_id', p_product_id::TEXT,
      'visitor_ip', v_ip,
      'store_slug', lower(trim(p_slug)),
      'page_path', NULLIF(trim(p_page_path), '')
    )
  );

  RETURN jsonb_build_object('success', true, 'buffered', true);
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_product_view_by_slug(TEXT, UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Hot-path index verification (service_role / ops)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_verify_analytics_hot_path_indexes()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required TEXT[] := ARRAY[
    'idx_analytics_event_outbox_visit_dedupe',
    'idx_analytics_event_outbox_product_dedupe',
    'idx_analytics_event_outbox_owner_type_created',
    'idx_analytics_event_outbox_pending'
  ];
  v_name TEXT;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_outbox_rows BIGINT := 0;
  v_pending INT := 0;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role only';
  END IF;

  FOREACH v_name IN ARRAY v_required LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename LIKE 'analytics_event_outbox%'
        AND indexname = v_name
    ) THEN
      v_missing := array_append(v_missing, v_name);
    END IF;
  END LOOP;

  SELECT COUNT(*)::BIGINT INTO v_outbox_rows FROM public.analytics_event_outbox;
  SELECT COUNT(*)::INT INTO v_pending FROM public.analytics_event_outbox WHERE processed_at IS NULL;

  RETURN jsonb_build_object(
    'ok', COALESCE(array_length(v_missing, 1), 0) = 0,
    'missing_indexes', COALESCE(v_missing, ARRAY[]::TEXT[]),
    'outbox_total_rows', v_outbox_rows,
    'outbox_pending_rows', v_pending,
    'regression_risk', CASE
      WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'critical'
      WHEN v_outbox_rows > 100000 THEN 'warn'
      ELSE 'ok'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_verify_analytics_hot_path_indexes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_verify_analytics_hot_path_indexes() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (97, 'perf_regression_fix: restore analytics outbox dedupe indexes + hot-path visit order')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
