-- Worker architecture hardening: registry, unified heartbeats, conditional pg_cron fallbacks,
-- comprehensive health audit. Ensures primary edge workers + pg_cron fallback without duplicate drain.

-- ---------------------------------------------------------------------------
-- 1) Extend worker heartbeats — failure tracking
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_worker_heartbeats
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2) Worker registry — canonical definitions for health audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_worker_registry (
  worker_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  primary_trigger TEXT NOT NULL,
  fallback_trigger TEXT,
  processor TEXT NOT NULL,
  expected_interval_minutes INT NOT NULL DEFAULT 5,
  stale_threshold_minutes INT NOT NULL DEFAULT 10,
  retry_limit INT,
  has_dead_letter BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);

COMMENT ON TABLE public.platform_worker_registry IS
  'Canonical background worker definitions — used by platform_worker_health_audit';

INSERT INTO public.platform_worker_registry (
  worker_id, display_name, primary_trigger, fallback_trigger, processor,
  expected_interval_minutes, stale_threshold_minutes, retry_limit, has_dead_letter, notes
) VALUES
  (
    'process_background_worker_bundle', 'Unified background bundle', 'edge_cron', 'pg_cron',
    'process_background_worker_bundle', 3, 10, 1, false,
    'Edge process-background-queue; side effects + analytics + recovery + lifecycle'
  ),
  (
    'process-order-webhook-outbox', 'Webhook HTTP delivery worker', 'edge_cron', 'pg_cron',
    'process-order-webhook-outbox', 2, 10, 5, true,
    'Edge process-order-webhook-outbox; claim → HTTP → finalize'
  ),
  (
    'process_analytics_event_buffer', 'Analytics outbox processor', 'edge_cron', 'pg_cron',
    'process_analytics_event_buffer', 2, 10, 8, true,
    'Primary via bundle; pg_cron fallback when edge stale'
  ),
  (
    'process_order_side_effects_batch', 'Order side effects processor', 'edge_cron', 'pg_cron',
    'process_order_side_effects_batch', 2, 10, 10, true,
    'Primary via webhook/bundle edge; pg_cron fallback when edge stale'
  ),
  (
    'recover_stale_webhook_processing', 'Stale webhook recovery', 'pg_cron', NULL,
    'recover_stale_webhook_processing', 5, 15, NULL, false,
    'Resets processing webhooks stuck > 15 min'
  ),
  (
    'recover_stale_import_jobs', 'Stale import job recovery', 'edge_cron', NULL,
    'recover_stale_import_jobs', 5, 30, NULL, false,
    'Resets import_jobs stuck in processing > 30 min'
  ),
  (
    'process-import-jobs', 'Product CSV import batches', 'edge_on_demand', 'client_poll',
    'process_product_import_batch', 60, 30, NULL, false,
    'Merchant-triggered edge + client sync loop'
  )
ON CONFLICT (worker_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  primary_trigger = EXCLUDED.primary_trigger,
  fallback_trigger = EXCLUDED.fallback_trigger,
  processor = EXCLUDED.processor,
  expected_interval_minutes = EXCLUDED.expected_interval_minutes,
  stale_threshold_minutes = EXCLUDED.stale_threshold_minutes,
  retry_limit = EXCLUDED.retry_limit,
  has_dead_letter = EXCLUDED.has_dead_letter,
  notes = EXCLUDED.notes;

ALTER TABLE public.platform_worker_registry ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3) Unified heartbeat recorder
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_platform_worker_heartbeat(
  p_worker_id TEXT,
  p_success BOOLEAN,
  p_result JSONB DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_failures INT := 0;
BEGIN
  SELECT consecutive_failures INTO v_prev_failures
  FROM public.platform_worker_heartbeats WHERE worker_id = p_worker_id;

  IF p_success THEN
    INSERT INTO public.platform_worker_heartbeats (
      worker_id, last_success_at, last_result, last_failure_at, last_error,
      consecutive_failures, updated_at
    )
    VALUES (p_worker_id, NOW(), p_result, NULL, NULL, 0, NOW())
    ON CONFLICT (worker_id) DO UPDATE SET
      last_success_at = EXCLUDED.last_success_at,
      last_result = EXCLUDED.last_result,
      last_failure_at = NULL,
      last_error = NULL,
      consecutive_failures = 0,
      updated_at = NOW();
  ELSE
    INSERT INTO public.platform_worker_heartbeats (
      worker_id, last_failure_at, last_result, last_error,
      consecutive_failures, updated_at
    )
    VALUES (
      p_worker_id, NOW(), p_result, LEFT(COALESCE(p_error, 'unknown'), 500),
      COALESCE(v_prev_failures, 0) + 1, NOW()
    )
    ON CONFLICT (worker_id) DO UPDATE SET
      last_failure_at = EXCLUDED.last_failure_at,
      last_result = EXCLUDED.last_result,
      last_error = EXCLUDED.last_error,
      consecutive_failures = public.platform_worker_heartbeats.consecutive_failures + 1,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'worker_id', p_worker_id,
    'recorded_success', p_success
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_platform_worker_heartbeat(TEXT, BOOLEAN, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_platform_worker_heartbeat(TEXT, BOOLEAN, JSONB, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Helper — recent success check for conditional cron fallbacks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._worker_recently_succeeded(
  p_worker_id TEXT,
  p_within_minutes INT DEFAULT 3
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_worker_heartbeats
    WHERE worker_id = p_worker_id
      AND last_success_at IS NOT NULL
      AND last_success_at >= NOW() - (GREATEST(COALESCE(p_within_minutes, 3), 1) || ' minutes')::INTERVAL
  );
$$;

-- ---------------------------------------------------------------------------
-- 5) Conditional pg_cron fallbacks — skip when primary edge worker is healthy
--    Idempotency preserved via SKIP LOCKED in batch processors.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_analytics_event_buffer_cron_fallback()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_pending INT := 0;
BEGIN
  SELECT COUNT(*)::INT INTO v_old_pending
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL AND dead_letter_at IS NULL
    AND created_at < NOW() - INTERVAL '5 minutes';

  IF public._worker_recently_succeeded('process_background_worker_bundle', 3)
     AND v_old_pending = 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'edge_bundle_recent', 'worker_id', 'process_analytics_event_buffer');
  END IF;

  RETURN public.process_analytics_event_buffer(500);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_order_side_effects_batch_cron_fallback()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_pending INT := 0;
BEGIN
  SELECT COUNT(*)::INT INTO v_old_pending
  FROM public.order_side_effects_outbox
  WHERE processed_at IS NULL AND dead_letter_at IS NULL
    AND created_at < NOW() - INTERVAL '5 minutes';

  IF (
    public._worker_recently_succeeded('process-order-webhook-outbox', 3)
    OR public._worker_recently_succeeded('process_background_worker_bundle', 3)
  ) AND v_old_pending = 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'edge_worker_recent', 'worker_id', 'process_order_side_effects_batch');
  END IF;

  RETURN public.process_order_side_effects_batch(50);
END;
$$;

REVOKE ALL ON FUNCTION public.process_analytics_event_buffer_cron_fallback() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_order_side_effects_batch_cron_fallback() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_analytics_event_buffer_cron_fallback() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_order_side_effects_batch_cron_fallback() TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Bundle — record unified heartbeat on success/failure
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_background_worker_bundle(
  p_limit INT DEFAULT 50,
  p_stale_webhook_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_side JSONB;
  v_analytics JSONB;
  v_recovery JSONB;
  v_import JSONB;
  v_lifecycle JSONB;
  v_health JSONB;
  v_result JSONB;
BEGIN
  PERFORM set_config('statement_timeout', '60000', true);
  PERFORM set_config('lock_timeout', '10000', true);

  v_side := public.process_order_side_effects_batch(v_limit);
  v_analytics := public.process_analytics_event_buffer(LEAST(v_limit * 4, 500));
  v_recovery := public.recover_stale_webhook_processing(GREATEST(COALESCE(p_stale_webhook_minutes, 15), 5));
  v_import := public.recover_stale_import_jobs(30);
  v_lifecycle := public.platform_run_data_lifecycle();
  v_health := public.platform_queue_health_audit();

  v_result := jsonb_build_object(
    'success', true,
    'ran_at', now(),
    'side_effects', v_side,
    'analytics', v_analytics,
    'webhook_recovery', v_recovery,
    'import_recovery', v_import,
    'lifecycle', v_lifecycle,
    'health', v_health
  );

  PERFORM public.record_platform_worker_heartbeat(
    'process_background_worker_bundle', true, v_result, NULL
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object('success', false, 'error', LEFT(SQLERRM, 300));
  PERFORM public.record_platform_worker_heartbeat(
    'process_background_worker_bundle', false, v_result, SQLERRM
  );
  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Comprehensive worker health audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_worker_health_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker RECORD;
  v_workers JSONB := '[]'::JSONB;
  v_entry JSONB;
  v_stale_count INT := 0;
  v_critical_count INT := 0;
  v_cron_jobs JSONB := '[]'::JSONB;
  v_queue_health JSONB;
  v_overall TEXT := 'ok';
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'jobname', jobname,
      'schedule', schedule,
      'active', active,
      'command', LEFT(command, 120)
    ) ORDER BY jobname), '[]'::jsonb)
    INTO v_cron_jobs
    FROM cron.job
    WHERE jobname IN (
      'process-analytics-buffer', 'process-order-side-effects',
      'recover-stale-webhook-processing', 'worker-health-check'
    );
  END IF;

  FOR v_worker IN
    SELECT r.*, h.last_success_at, h.last_failure_at, h.last_error,
           h.consecutive_failures, h.last_result
    FROM public.platform_worker_registry r
    LEFT JOIN public.platform_worker_heartbeats h ON h.worker_id = r.worker_id
    ORDER BY r.worker_id
  LOOP
    v_entry := jsonb_build_object(
      'worker_id', v_worker.worker_id,
      'display_name', v_worker.display_name,
      'primary_trigger', v_worker.primary_trigger,
      'fallback_trigger', v_worker.fallback_trigger,
      'processor', v_worker.processor,
      'expected_interval_minutes', v_worker.expected_interval_minutes,
      'stale_threshold_minutes', v_worker.stale_threshold_minutes,
      'retry_limit', v_worker.retry_limit,
      'has_dead_letter', v_worker.has_dead_letter,
      'last_success_at', v_worker.last_success_at,
      'last_failure_at', v_worker.last_failure_at,
      'last_error', v_worker.last_error,
      'consecutive_failures', COALESCE(v_worker.consecutive_failures, 0),
      'minutes_since_success',
        CASE WHEN v_worker.last_success_at IS NULL THEN NULL
             ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - v_worker.last_success_at)) / 60.0, 1) END,
      'stale',
        v_worker.last_success_at IS NOT NULL
        AND v_worker.last_success_at < NOW() - (v_worker.stale_threshold_minutes || ' minutes')::INTERVAL,
      'never_ran', v_worker.last_success_at IS NULL
    );

    IF (v_entry->>'stale')::boolean THEN
      v_stale_count := v_stale_count + 1;
    END IF;

    v_workers := v_workers || jsonb_build_array(v_entry);
  END LOOP;

  v_queue_health := public.platform_queue_health_audit();

  IF COALESCE((v_queue_health->>'critical')::boolean, false) OR v_stale_count >= 2 THEN
    v_overall := 'critical';
    v_critical_count := v_stale_count;
  ELSIF v_stale_count > 0 OR COALESCE((v_queue_health->>'critical')::boolean, false) THEN
    v_overall := 'degraded';
  END IF;

  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'overall', v_overall,
    'stale_workers', v_stale_count,
    'workers', v_workers,
    'pg_cron_jobs', v_cron_jobs,
    'queue_health', v_queue_health,
    'recommendations',
      CASE
        WHEN v_overall = 'critical' THEN jsonb_build_array(
          'Verify Supabase Edge cron schedules for process-background-queue and process-order-webhook-outbox',
          'Check BACKGROUND_WORKER_SECRET is set on edge functions',
          'Invoke process-background-queue manually to drain backlog',
          'Review pg_cron fallback jobs — they activate when edge workers are stale'
        )
        WHEN v_stale_count > 0 THEN jsonb_build_array(
          'One or more workers stale — pg_cron fallbacks should be draining queues'
        )
        ELSE '[]'::jsonb
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_worker_health_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_worker_health_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Reschedule pg_cron to use conditional fallbacks + worker health check
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'process-analytics-buffer', 'process-order-side-effects', 'worker-health-check'
    );

    PERFORM cron.schedule(
      'process-analytics-buffer',
      '* * * * *',
      $$SELECT public.process_analytics_event_buffer_cron_fallback()$$
    );

    PERFORM cron.schedule(
      'process-order-side-effects',
      '* * * * *',
      $$SELECT public.process_order_side_effects_batch_cron_fallback()$$
    );

    PERFORM cron.schedule(
      'worker-health-check',
      '*/5 * * * *',
      $$SELECT public.platform_worker_health_audit()$$
    );
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available — configure edge cron + manual health checks';
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron worker schedule skipped: %', SQLERRM;
END;
$cron$;

-- ---------------------------------------------------------------------------
-- 9) Extend get_background_jobs_status with worker health summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_background_jobs_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_analytics_pending INT := 0;
  v_analytics_oldest INT := 0;
  v_analytics_dead INT := 0;
  v_webhook_pending INT := 0;
  v_webhook_processing INT := 0;
  v_webhook_failed INT := 0;
  v_webhook_oldest INT := 0;
  v_side_pending INT := 0;
  v_side_oldest INT := 0;
  v_side_dead INT := 0;
  v_import_pending INT := 0;
  v_import_processing INT := 0;
  v_analytics_stale BOOLEAN := false;
  v_side_stale BOOLEAN := false;
  v_webhook_worker_stale BOOLEAN := false;
  v_bundle_stale BOOLEAN := false;
  v_status TEXT := 'ok';
BEGIN
  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT, 0),
         (SELECT COUNT(*)::INT FROM public.analytics_event_outbox WHERE dead_letter_at IS NOT NULL)
  INTO v_analytics_pending, v_analytics_oldest, v_analytics_dead
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

  SELECT COUNT(*) FILTER (WHERE status = 'pending')::INT,
         COUNT(*) FILTER (WHERE status = 'processing')::INT,
         COUNT(*) FILTER (WHERE status = 'failed')::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'pending')))::INT, 0)
  INTO v_webhook_pending, v_webhook_processing, v_webhook_failed, v_webhook_oldest
  FROM public.order_webhook_outbox;

  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT, 0),
         (SELECT COUNT(*)::INT FROM public.order_side_effects_outbox WHERE dead_letter_at IS NOT NULL)
  INTO v_side_pending, v_side_oldest, v_side_dead
  FROM public.order_side_effects_outbox
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

  IF public._platform_table_exists('import_jobs') THEN
    SELECT COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::INT,
           COUNT(*) FILTER (WHERE status = 'processing')::INT
    INTO v_import_pending, v_import_processing FROM public.import_jobs;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.platform_worker_heartbeats
    WHERE worker_id = 'process_analytics_event_buffer'
      AND last_success_at < NOW() - INTERVAL '10 minutes'
  ) AND v_analytics_pending > 0 INTO v_analytics_stale;

  SELECT EXISTS (
    SELECT 1 FROM public.platform_worker_heartbeats
    WHERE worker_id = 'process_order_side_effects_batch'
      AND last_success_at < NOW() - INTERVAL '10 minutes'
  ) AND v_side_pending > 0 INTO v_side_stale;

  SELECT EXISTS (
    SELECT 1 FROM public.platform_worker_heartbeats
    WHERE worker_id = 'process-order-webhook-outbox'
      AND (last_success_at IS NULL OR last_success_at < NOW() - INTERVAL '10 minutes')
  ) AND (v_webhook_pending > 0 OR v_side_pending > 0) INTO v_webhook_worker_stale;

  SELECT EXISTS (
    SELECT 1 FROM public.platform_worker_heartbeats
    WHERE worker_id = 'process_background_worker_bundle'
      AND (last_success_at IS NULL OR last_success_at < NOW() - INTERVAL '10 minutes')
  ) AND (v_analytics_pending > 0 OR v_side_pending > 0) INTO v_bundle_stale;

  IF v_analytics_pending >= 5000 OR v_webhook_pending >= 500 OR v_webhook_failed >= 100
     OR v_side_pending >= 1000 OR v_analytics_stale OR v_side_stale
     OR v_webhook_worker_stale OR v_bundle_stale THEN
    v_status := 'critical';
  ELSIF v_analytics_pending >= 500 OR v_webhook_pending >= 100 OR v_side_pending >= 200
        OR v_analytics_oldest > 600 OR v_webhook_oldest > 600 OR v_side_oldest > 300
        OR v_analytics_dead > 0 OR v_side_dead > 0 THEN
    v_status := 'degraded';
  ELSIF v_analytics_pending >= 100 OR v_webhook_pending >= 25 OR v_side_pending >= 50
        OR v_analytics_oldest > 180 OR v_webhook_oldest > 180 OR v_side_oldest > 120 THEN
    v_status := 'warn';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'analytics', jsonb_build_object(
      'pending', v_analytics_pending, 'oldest_pending_seconds', v_analytics_oldest,
      'dead_letter', v_analytics_dead, 'worker_stale', v_analytics_stale,
      'processor', 'process_analytics_event_buffer'
    ),
    'order_webhooks', jsonb_build_object(
      'pending', v_webhook_pending, 'processing', v_webhook_processing,
      'failed_dead_letter', v_webhook_failed, 'oldest_pending_seconds', v_webhook_oldest,
      'worker_stale', v_webhook_worker_stale,
      'processor', 'process-order-webhook-outbox'
    ),
    'order_side_effects', jsonb_build_object(
      'pending', v_side_pending, 'oldest_pending_seconds', v_side_oldest,
      'dead_letter', v_side_dead, 'worker_stale', v_side_stale,
      'processor', 'process_order_side_effects_batch'
    ),
    'import_jobs', jsonb_build_object(
      'pending_or_processing', v_import_pending, 'processing', v_import_processing,
      'processor', 'process-import-jobs + recover_stale_import_jobs'
    ),
    'workers', jsonb_build_object(
      'bundle_stale', v_bundle_stale,
      'webhook_worker_stale', v_webhook_worker_stale,
      'primary', 'process-background-queue + process-order-webhook-outbox',
      'fallback', 'pg_cron conditional fallbacks'
    ),
    'unified_worker', 'process-background-queue',
    'recommendations',
      CASE
        WHEN v_webhook_worker_stale OR v_bundle_stale THEN
          jsonb_build_array('CRITICAL: edge worker stale — verify Supabase Edge cron + BACKGROUND_WORKER_SECRET; invoke process-background-queue')
        WHEN v_analytics_stale OR v_side_stale THEN
          jsonb_build_array('CRITICAL: batch processor stale — pg_cron fallback should activate; check platform_worker_health_audit')
        WHEN v_side_dead > 0 THEN jsonb_build_array('retry_side_effects_dead_letter for failed checkout side effects')
        WHEN v_analytics_dead > 0 THEN jsonb_build_array('retry_analytics_dead_letter for poison analytics events')
        WHEN v_webhook_failed >= 50 THEN jsonb_build_array('retry_order_webhook_events')
        ELSE '[]'::jsonb
      END
  );
END;
$$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (112, 'worker architecture: registry, unified heartbeats, conditional pg_cron fallbacks, health audit')
ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes, applied_at = NOW();
