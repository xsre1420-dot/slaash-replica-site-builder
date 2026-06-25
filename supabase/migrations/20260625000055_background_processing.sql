-- v55: Background processing — webhook outbox consumer, unified job monitoring, retry/DLQ

-- ---------------------------------------------------------------------------
-- 1) Merchant webhook URL + outbox retry scheduling
-- ---------------------------------------------------------------------------
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS order_webhook_url TEXT;

COMMENT ON COLUMN public.store_settings.order_webhook_url IS
  'Optional HTTPS endpoint for order.created webhook delivery (background worker)';

ALTER TABLE public.order_webhook_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_order_webhook_outbox_retry
  ON public.order_webhook_outbox (status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

-- Allow replay from dead-letter
ALTER TABLE public.order_webhook_outbox
  DROP CONSTRAINT IF EXISTS order_webhook_outbox_status_check;

ALTER TABLE public.order_webhook_outbox
  ADD CONSTRAINT order_webhook_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'delivered', 'failed'));

-- ---------------------------------------------------------------------------
-- 2) Claim batch for delivery workers (SKIP LOCKED)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_order_webhook_outbox_batch(
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_jobs JSONB := '[]'::jsonb;
  v_no_url INT := 0;
BEGIN
  -- Internal-only merchants (no webhook URL): mark delivered immediately
  WITH no_url AS (
    SELECT o.id
    FROM public.order_webhook_outbox o
    WHERE o.status = 'pending'
      AND o.next_attempt_at <= NOW()
      AND NOT EXISTS (
        SELECT 1
        FROM public.store_settings ss
        WHERE ss.owner_id = o.owner_id
          AND ss.order_webhook_url IS NOT NULL
          AND trim(ss.order_webhook_url) <> ''
          AND ss.order_webhook_url ~* '^https://'
      )
    ORDER BY o.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.order_webhook_outbox o
  SET status = 'delivered',
      processed_at = NOW(),
      last_error = 'no_webhook_configured'
  FROM no_url n
  WHERE o.id = n.id;

  GET DIAGNOSTICS v_no_url = ROW_COUNT;

  WITH claimed AS (
    SELECT o.id
    FROM public.order_webhook_outbox o
    INNER JOIN public.store_settings ss ON ss.owner_id = o.owner_id
    WHERE o.status = 'pending'
      AND o.next_attempt_at <= NOW()
      AND ss.order_webhook_url IS NOT NULL
      AND trim(ss.order_webhook_url) <> ''
      AND ss.order_webhook_url ~* '^https://'
    ORDER BY o.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  marked AS (
    UPDATE public.order_webhook_outbox o
    SET status = 'processing',
        attempts = o.attempts + 1
    FROM claimed c
    WHERE o.id = c.id
    RETURNING o.*
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'owner_id', m.owner_id,
        'order_id', m.order_id,
        'event_type', m.event_type,
        'payload', m.payload,
        'attempts', m.attempts,
        'webhook_url', ss.order_webhook_url
      )
      ORDER BY m.created_at
    ),
    '[]'::jsonb
  )
  INTO v_jobs
  FROM marked m
  INNER JOIN public.store_settings ss ON ss.owner_id = m.owner_id;

  RETURN jsonb_build_object(
    'success', true,
    'jobs', v_jobs,
    'delivered_without_url', v_no_url,
    'claimed', jsonb_array_length(v_jobs)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_webhook_outbox_batch(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_order_webhook_outbox_batch(INT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Finalize delivery — retry with exponential backoff or dead-letter
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_order_webhook_delivery(
  p_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INT;
  v_max_attempts INT := 5;
BEGIN
  SELECT attempts INTO v_attempts
  FROM public.order_webhook_outbox
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF p_success THEN
    UPDATE public.order_webhook_outbox
    SET status = 'delivered',
        processed_at = NOW(),
        last_error = NULL
    WHERE id = p_id;

    RETURN jsonb_build_object('success', true, 'status', 'delivered');
  END IF;

  IF v_attempts >= v_max_attempts THEN
    UPDATE public.order_webhook_outbox
    SET status = 'failed',
        processed_at = NOW(),
        last_error = LEFT(COALESCE(p_error, 'delivery_failed'), 2000)
    WHERE id = p_id;

    RETURN jsonb_build_object('success', true, 'status', 'failed', 'dead_letter', true);
  END IF;

  UPDATE public.order_webhook_outbox
  SET status = 'pending',
      last_error = LEFT(COALESCE(p_error, 'delivery_failed'), 2000),
      next_attempt_at = NOW() + (POWER(2, LEAST(v_attempts, 5)) * INTERVAL '1 second')
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'pending',
    'retry_after_seconds', POWER(2, LEAST(v_attempts, 5))::INT
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_order_webhook_delivery(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_order_webhook_delivery(UUID, BOOLEAN, TEXT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Merchant replay — reset failed events to pending
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retry_order_webhook_events(
  p_owner_id UUID,
  p_event_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset INT := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.order_webhook_outbox
  SET status = 'pending',
      next_attempt_at = NOW(),
      attempts = 0,
      last_error = NULL,
      processed_at = NULL
  WHERE owner_id = p_owner_id
    AND status = 'failed'
    AND (p_event_ids IS NULL OR id = ANY (p_event_ids));

  GET DIAGNOSTICS v_reset = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'reset', v_reset);
END;
$$;

REVOKE ALL ON FUNCTION public.retry_order_webhook_events(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_order_webhook_events(UUID, UUID[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Unified background job monitoring
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
  v_webhook_pending INT := 0;
  v_webhook_processing INT := 0;
  v_webhook_failed INT := 0;
  v_webhook_oldest INT := 0;
  v_status TEXT := 'ok';
BEGIN
  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT, 0)
  INTO v_analytics_pending, v_analytics_oldest
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL;

  SELECT COUNT(*) FILTER (WHERE status = 'pending')::INT,
         COUNT(*) FILTER (WHERE status = 'processing')::INT,
         COUNT(*) FILTER (WHERE status = 'failed')::INT,
         COALESCE(
           EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'pending')))::INT,
           0
         )
  INTO v_webhook_pending, v_webhook_processing, v_webhook_failed, v_webhook_oldest
  FROM public.order_webhook_outbox;

  IF v_analytics_pending >= 5000 OR v_webhook_pending >= 500 OR v_webhook_failed >= 100 THEN
    v_status := 'critical';
  ELSIF v_analytics_pending >= 500 OR v_webhook_pending >= 100
        OR v_analytics_oldest > 600 OR v_webhook_oldest > 600 THEN
    v_status := 'degraded';
  ELSIF v_analytics_pending >= 100 OR v_webhook_pending >= 25
        OR v_analytics_oldest > 180 OR v_webhook_oldest > 180 THEN
    v_status := 'warn';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_status,
    'analytics', jsonb_build_object(
      'pending', v_analytics_pending,
      'oldest_pending_seconds', v_analytics_oldest,
      'processor', 'process_analytics_event_buffer'
    ),
    'order_webhooks', jsonb_build_object(
      'pending', v_webhook_pending,
      'processing', v_webhook_processing,
      'failed_dead_letter', v_webhook_failed,
      'oldest_pending_seconds', v_webhook_oldest,
      'processor', 'claim_order_webhook_outbox_batch + edge worker'
    ),
    'recommendations',
      CASE
        WHEN v_webhook_processing > 10 THEN jsonb_build_array('stale_processing_rows — check edge worker')
        WHEN v_webhook_pending > 0 AND v_webhook_oldest > 120 THEN jsonb_build_array('invoke process-order-webhook-outbox edge function')
        WHEN v_analytics_pending > 0 AND v_analytics_oldest > 120 THEN jsonb_build_array('run process_analytics_event_buffer')
        ELSE '[]'::jsonb
      END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_background_jobs_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_background_jobs_status() FROM anon, authenticated;

-- Reset stuck processing rows (worker crash recovery)
CREATE OR REPLACE FUNCTION public.recover_stale_webhook_processing(
  p_stale_minutes INT DEFAULT 15
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset INT;
BEGIN
  UPDATE public.order_webhook_outbox
  SET status = 'pending',
      next_attempt_at = NOW() + INTERVAL '30 seconds',
      last_error = COALESCE(last_error, '') || ' [recovered from stale processing]'
  WHERE status = 'processing'
    AND created_at < NOW() - (GREATEST(COALESCE(p_stale_minutes, 15), 5) || ' minutes')::INTERVAL;

  GET DIAGNOSTICS v_reset = ROW_COUNT;
  RETURN v_reset;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stale_webhook_processing(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recover_stale_webhook_processing(INT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) pg_cron — analytics buffer + stale webhook recovery
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'process-analytics-buffer',
      'prune-analytics-outbox',
      'recover-stale-webhook-processing'
    );

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

    PERFORM cron.schedule(
      'recover-stale-webhook-processing',
      '*/5 * * * *',
      $$SELECT public.recover_stale_webhook_processing(15)$$
    );
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available';
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END;
$cron$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (55, 'background_processing: webhook consumer RPCs + unified job monitoring + DLQ retry')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
