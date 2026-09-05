-- Phase 0.3 follow-up: pg_cron drain + retry/dead-letter + enhanced backlog health.
-- Depends on 20260905000002/03 (batch unblock + customers hotfix).

-- ---------------------------------------------------------------------------
-- 1) Retry / dead-letter columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_side_effects_outbox
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_side_effects_outbox_dead_letter
  ON public.order_side_effects_outbox (dead_letter_at)
  WHERE dead_letter_at IS NOT NULL;

COMMENT ON COLUMN public.order_side_effects_outbox.attempt_count IS
  'Processing attempts — rows move to dead_letter_at after max retries';
COMMENT ON COLUMN public.order_side_effects_outbox.dead_letter_at IS
  'Set when max retries exceeded; row excluded from batch processor';

-- ---------------------------------------------------------------------------
-- 2) Batch processor — retry budget + dead-letter (idempotent effects unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_order_side_effects_batch(p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_max_attempts INT := 10;
  v_rec RECORD;
  v_order RECORD;
  v_processed INT := 0;
  v_failed INT := 0;
  v_dead_lettered INT := 0;
  v_shipment_id UUID;
  v_remaining TEXT[];
  v_result JSONB;
BEGIN
  PERFORM set_config('statement_timeout', '45000', true);
  PERFORM set_config('lock_timeout', '5000', true);
  PERFORM set_config('bidaya.side_effects_batch', '1', true);

  FOR v_rec IN
    SELECT o.*
    FROM public.order_side_effects_outbox o
    WHERE o.processed_at IS NULL
      AND o.dead_letter_at IS NULL
    ORDER BY o.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT * INTO v_order
      FROM public.orders
      WHERE id = v_rec.order_id AND owner_id = v_rec.owner_id;

      IF NOT FOUND THEN
        UPDATE public.order_side_effects_outbox
        SET processed_at = NOW(), last_error = 'order_not_found'
        WHERE id = v_rec.id;
        CONTINUE;
      END IF;

      v_remaining := v_rec.effects_pending;

      IF 'stats' = ANY (v_remaining) THEN
        PERFORM public.upsert_store_daily_order_stats(
          v_order.owner_id,
          (v_order.created_at AT TIME ZONE 'UTC')::DATE,
          COALESCE(v_order.status, 'pending'),
          COALESCE(v_order.total_amount, 0),
          1
        );
        v_remaining := array_remove(v_remaining, 'stats');
      END IF;

      IF 'shipment' = ANY (v_remaining) AND NOT EXISTS (
        SELECT 1 FROM public.shipments s WHERE s.order_id = v_order.id
      ) THEN
        INSERT INTO public.shipments (
          order_id, owner_id, status, delivery_fee,
          recipient_name, recipient_phone, delivery_address, governorate
        ) VALUES (
          v_order.id, v_order.owner_id, 'pending', COALESCE(v_order.delivery_fee, 0),
          v_order.customer_name, v_order.customer_phone, v_order.customer_address,
          v_order.customer_governorate
        )
        RETURNING id INTO v_shipment_id;

        INSERT INTO public.shipment_tracking_events (shipment_id, status, note)
        VALUES (v_shipment_id, 'pending', 'تم إنشاء الشحنة');
        v_remaining := array_remove(v_remaining, 'shipment');
      ELSIF 'shipment' = ANY (v_remaining) THEN
        v_remaining := array_remove(v_remaining, 'shipment');
      END IF;

      IF 'webhook' = ANY (v_remaining) AND NOT EXISTS (
        SELECT 1 FROM public.order_webhook_outbox w
        WHERE w.order_id = v_order.id AND w.event_type = 'order.created'
      ) THEN
        INSERT INTO public.order_webhook_outbox (
          owner_id, store_id, order_id, event_type, payload
        ) VALUES (
          v_order.owner_id, v_order.store_id, v_order.id, 'order.created',
          jsonb_build_object(
            'order_id', v_order.id, 'owner_id', v_order.owner_id,
            'store_id', v_order.store_id, 'status', v_order.status,
            'total_amount', v_order.total_amount,
            'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone,
            'created_at', v_order.created_at
          )
        );
        v_remaining := array_remove(v_remaining, 'webhook');
      ELSIF 'webhook' = ANY (v_remaining) THEN
        v_remaining := array_remove(v_remaining, 'webhook');
      END IF;

      IF 'customer' = ANY (v_remaining) THEN
        IF EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.owner_id = v_order.owner_id
            AND c.phone = v_order.customer_phone
            AND c.last_order_date IS NOT DISTINCT FROM v_order.created_at
            AND c.total_orders >= 1
        ) THEN
          v_remaining := array_remove(v_remaining, 'customer');
        ELSIF EXISTS (
          SELECT 1 FROM public.customers c
          WHERE c.owner_id = v_order.owner_id AND c.phone = v_order.customer_phone
        ) THEN
          UPDATE public.customers c
          SET
            name = COALESCE(v_order.customer_name, c.name),
            last_order_date = GREATEST(c.last_order_date, v_order.created_at),
            total_orders = c.total_orders + 1,
            total_spent = c.total_spent + COALESCE(v_order.total_amount, 0)
          WHERE c.owner_id = v_order.owner_id AND c.phone = v_order.customer_phone;
          v_remaining := array_remove(v_remaining, 'customer');
        ELSE
          INSERT INTO public.customers (
            owner_id, phone, name, first_order_date, last_order_date, total_orders, total_spent
          ) VALUES (
            v_order.owner_id, v_order.customer_phone, v_order.customer_name,
            v_order.created_at, v_order.created_at, 1, v_order.total_amount
          );
          v_remaining := array_remove(v_remaining, 'customer');
        END IF;
      END IF;

      UPDATE public.order_side_effects_outbox
      SET effects_pending = v_remaining,
          processed_at = CASE WHEN COALESCE(array_length(v_remaining, 1), 0) = 0 THEN NOW() ELSE NULL END,
          last_error = NULL,
          attempt_count = 0
      WHERE id = v_rec.id;

      IF COALESCE(array_length(v_remaining, 1), 0) = 0 THEN
        v_processed := v_processed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.order_side_effects_outbox
      SET attempt_count = v_rec.attempt_count + 1,
          last_error = LEFT(SQLERRM, 500),
          dead_letter_at = CASE
            WHEN v_rec.attempt_count + 1 >= v_max_attempts THEN NOW()
            ELSE NULL
          END
      WHERE id = v_rec.id;

      IF v_rec.attempt_count + 1 >= v_max_attempts THEN
        v_dead_lettered := v_dead_lettered + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;
    END;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'failed', v_failed,
    'dead_lettered', v_dead_lettered,
    'pending', (
      SELECT COUNT(*)::INT FROM public.order_side_effects_outbox
      WHERE processed_at IS NULL AND dead_letter_at IS NULL
    ),
    'dead_letter', (
      SELECT COUNT(*)::INT FROM public.order_side_effects_outbox
      WHERE dead_letter_at IS NOT NULL
    )
  );

  INSERT INTO public.platform_worker_heartbeats (worker_id, last_success_at, last_result, updated_at)
  VALUES ('process_order_side_effects_batch', NOW(), v_result, NOW())
  ON CONFLICT (worker_id) DO UPDATE SET
    last_success_at = EXCLUDED.last_success_at,
    last_result = EXCLUDED.last_result,
    updated_at = EXCLUDED.updated_at;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.process_order_side_effects_batch(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_side_effects_batch(INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Enhanced backlog health
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.side_effects_outbox_backlog_health()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending INT;
  v_oldest_minutes NUMERIC;
  v_errors INT;
  v_dead_letter INT;
  v_last_run TIMESTAMPTZ;
  v_processed_60s INT;
BEGIN
  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 60.0, 0),
         COUNT(*) FILTER (WHERE last_error IS NOT NULL AND trim(last_error) <> '')::INT
    INTO v_pending, v_oldest_minutes, v_errors
  FROM public.order_side_effects_outbox
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

  SELECT COUNT(*)::INT INTO v_dead_letter
  FROM public.order_side_effects_outbox
  WHERE dead_letter_at IS NOT NULL;

  SELECT last_success_at INTO v_last_run
  FROM public.platform_worker_heartbeats
  WHERE worker_id = 'process_order_side_effects_batch';

  SELECT COUNT(*)::INT INTO v_processed_60s
  FROM public.order_side_effects_outbox
  WHERE processed_at IS NOT NULL
    AND processed_at >= NOW() - INTERVAL '60 seconds';

  RETURN jsonb_build_object(
    'pending', v_pending,
    'oldest_minutes', ROUND(v_oldest_minutes, 1),
    'errors', v_errors,
    'dead_letter', v_dead_letter,
    'processed_last_60s', v_processed_60s,
    'last_worker_success_at', v_last_run,
    'worker_stale_minutes',
      CASE WHEN v_last_run IS NULL THEN NULL
           ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - v_last_run)) / 60.0, 1)
      END,
    'healthy', v_pending < 100 AND v_oldest_minutes < 5 AND v_errors = 0 AND v_dead_letter = 0,
    'warning', v_pending >= 100 OR v_oldest_minutes >= 5 OR v_errors > 0 OR v_dead_letter > 0,
    'critical', v_pending >= 500 OR v_oldest_minutes >= 30 OR v_dead_letter >= 10
      OR (v_pending > 0 AND v_last_run IS NOT NULL AND v_last_run < NOW() - INTERVAL '10 minutes')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.side_effects_outbox_backlog_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.side_effects_outbox_backlog_health() TO service_role;

-- ---------------------------------------------------------------------------
-- 4) pg_cron — drain side effects every minute (fallback when edge worker idle)
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'process-order-side-effects';

    PERFORM cron.schedule(
      'process-order-side-effects',
      '* * * * *',
      $$SELECT public.process_order_side_effects_batch(50)$$
    );
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available — schedule side-effects drain via edge worker';
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron side-effects schedule skipped: %', SQLERRM;
END;
$cron$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (123, 'phase 0.3: side effects pg_cron drain + retry/dead-letter + health')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
