-- v54: Analytics hot-path hardening — remove blocking inline flush from tracking RPCs.
-- Storefront visit/product view = 1 outbox INSERT only (never waits on batch processor).
-- Background: pg_cron when available + manual process_analytics_event_buffer for ops.

-- ---------------------------------------------------------------------------
-- 1) Pipeline status (ops / health monitor — service role or authenticated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_analytics_pipeline_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending INT := 0;
  v_oldest_seconds INT := 0;
  v_processed_1h INT := 0;
  v_status TEXT := 'ok';
BEGIN
  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT, 0)
  INTO v_pending, v_oldest_seconds
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL;

  SELECT COUNT(*)::INT
  INTO v_processed_1h
  FROM public.analytics_event_outbox
  WHERE processed_at IS NOT NULL
    AND processed_at > NOW() - INTERVAL '1 hour';

  IF v_pending >= 5000 THEN
    v_status := 'critical';
  ELSIF v_pending >= 500 OR v_oldest_seconds > 600 THEN
    v_status := 'degraded';
  ELSIF v_pending >= 100 OR v_oldest_seconds > 180 THEN
    v_status := 'warn';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pending_events', v_pending,
    'oldest_pending_seconds', v_oldest_seconds,
    'processed_last_hour', v_processed_1h,
    'status', v_status,
    'cron_recommended', v_pending > 0 AND v_oldest_seconds > 120
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_analytics_pipeline_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_analytics_pipeline_status() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Merchant-scoped analytics health audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_merchant_analytics_health(
  p_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending INT := 0;
  v_today_visits INT := 0;
  v_today_rollup INT := 0;
  v_score INT := 100;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*)::INT
  INTO v_pending
  FROM public.analytics_event_outbox
  WHERE owner_id = p_owner_id
    AND processed_at IS NULL;

  SELECT COUNT(*)::INT
  INTO v_today_visits
  FROM public.store_visits
  WHERE owner_id = p_owner_id
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC');

  SELECT COALESCE(visit_count, 0)::INT
  INTO v_today_rollup
  FROM public.store_daily_stats
  WHERE owner_id = p_owner_id
    AND stat_date = (CURRENT_DATE AT TIME ZONE 'UTC')::DATE;

  IF v_pending > 50 THEN
    v_score := v_score - LEAST(30, v_pending / 5);
  ELSIF v_pending > 10 THEN
    v_score := v_score - 10;
  END IF;

  IF v_today_visits > 0 AND v_today_rollup = 0 AND v_pending = 0 THEN
    v_score := v_score - 15;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'score', GREATEST(0, v_score),
    'pending_buffered_events', v_pending,
    'today_visits_raw', v_today_visits,
    'today_visits_rollup', v_today_rollup,
    'rollup_lag', GREATEST(0, v_today_visits + v_pending - v_today_rollup),
    'recommendation',
      CASE
        WHEN v_pending > 100 THEN 'Run process_analytics_event_buffer or enable pg_cron'
        WHEN v_pending > 0 THEN 'Minor buffer lag — will flush on next cron cycle'
        ELSE 'ok'
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_merchant_analytics_health(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_merchant_analytics_health(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Visit tracking — buffer-only hot path (no inline batch flush)
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
    FROM public.analytics_event_outbox o
    WHERE o.owner_id = v_owner
      AND o.event_type = 'store_visit'
      AND o.payload->>'visitor_ip' = v_ip
      AND o.payload->>'page_path' = v_path
      AND o.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM public.store_visits sv
    WHERE sv.owner_id = v_owner
      AND sv.visitor_ip = v_ip
      AND sv.page_path = v_path
      AND sv.created_at > NOW() - INTERVAL '30 minutes'
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
-- 4) Product view tracking — buffer-only hot path
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
    FROM public.analytics_event_outbox o
    WHERE o.owner_id = v_owner_id
      AND o.event_type = 'product_view'
      AND o.payload->>'product_id' = p_product_id::TEXT
      AND o.payload->>'visitor_ip' = v_ip
      AND o.created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  ) OR EXISTS (
    SELECT 1
    FROM public.product_views pv
    WHERE pv.owner_id = v_owner_id
      AND pv.product_id = p_product_id
      AND pv.visitor_ip = v_ip
      AND pv.created_at > NOW() - INTERVAL '30 minutes'
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
-- 5) pg_cron schedules (when extension is enabled on Supabase Pro+)
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('process-analytics-buffer', 'prune-analytics-outbox');

    PERFORM cron.schedule(
      'process-analytics-buffer',
      '* * * * *',
      $$SELECT public.process_analytics_event_buffer(500)$$
    );

    PERFORM cron.schedule(
      'prune-analytics-outbox',
      '0 3 * * *',
      $$SELECT public.prune_analytics_event_outbox(7)$$
    );
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron schema not available — schedule buffer flush manually';
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END;
$cron$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (54, 'analytics_hot_path: non-blocking tracking RPCs + pipeline health + pg_cron')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
