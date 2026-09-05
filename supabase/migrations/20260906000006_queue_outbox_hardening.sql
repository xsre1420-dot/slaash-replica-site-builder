-- Queue / outbox hardening: dead-letter recovery, backoff, worker-stale detection, import recovery.
-- Ensures worker outages surface as critical health — not silent infinite pending.

-- ---------------------------------------------------------------------------
-- 1) Analytics outbox — retry budget + dead-letter
-- ---------------------------------------------------------------------------
ALTER TABLE public.analytics_event_outbox
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS dead_letter_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_dead_letter
  ON public.analytics_event_outbox (dead_letter_at)
  WHERE dead_letter_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_event_outbox_pending_retry
  ON public.analytics_event_outbox (created_at)
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Side effects — exponential backoff between retries
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_side_effects_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_order_side_effects_outbox_pending_retry
  ON public.order_side_effects_outbox (created_at)
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Analytics batch processor — dead-letter + heartbeat on failure
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_analytics_event_buffer(p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
  v_max_attempts INT := 8;
  v_scope_owner UUID;
  v_scope_raw TEXT := NULLIF(trim(current_setting('app.analytics_owner_scope', true)), '');
  v_ids BIGINT[];
  v_visit_rows INT := 0;
  v_product_rows INT := 0;
  v_trigger_disabled BOOLEAN := false;
  v_dead_lettered INT := 0;
  v_result JSONB;
BEGIN
  IF v_scope_raw IS NOT NULL THEN
    BEGIN
      v_scope_owner := v_scope_raw::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_scope_owner := NULL;
    END;
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::BIGINT[])
  INTO v_ids
  FROM (
    SELECT id
    FROM public.analytics_event_outbox
    WHERE processed_at IS NULL
      AND dead_letter_at IS NULL
      AND next_attempt_at <= NOW()
      AND (v_scope_owner IS NULL OR owner_id = v_scope_owner)
    ORDER BY created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ) locked;

  IF array_length(v_ids, 1) IS NULL OR array_length(v_ids, 1) = 0 THEN
    v_result := jsonb_build_object(
      'processed', 0, 'store_visits', 0, 'product_views', 0, 'owner_scope', v_scope_owner,
      'pending', (SELECT COUNT(*)::INT FROM public.analytics_event_outbox
                  WHERE processed_at IS NULL AND dead_letter_at IS NULL),
      'dead_letter', (SELECT COUNT(*)::INT FROM public.analytics_event_outbox WHERE dead_letter_at IS NOT NULL)
    );
    INSERT INTO public.platform_worker_heartbeats (worker_id, last_success_at, last_result, updated_at)
    VALUES ('process_analytics_event_buffer', NOW(), v_result, NOW())
    ON CONFLICT (worker_id) DO UPDATE SET last_success_at = EXCLUDED.last_success_at, last_result = EXCLUDED.last_result, updated_at = EXCLUDED.updated_at;
    RETURN v_result;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.analytics_event_outbox o
    WHERE o.id = ANY (v_ids) AND o.event_type = 'store_visit'
  ) THEN
    ALTER TABLE public.store_visits DISABLE TRIGGER visits_daily_stats_trg;
    v_trigger_disabled := true;

    INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent, created_at)
    SELECT o.owner_id,
           NULLIF(btrim(o.payload->>'visitor_ip'), ''),
           COALESCE(NULLIF(btrim(o.payload->>'page_path'), ''), '/'),
           LEFT(o.payload->>'user_agent', 512),
           o.created_at
    FROM public.analytics_event_outbox o
    WHERE o.id = ANY (v_ids) AND o.event_type = 'store_visit';

    GET DIAGNOSTICS v_visit_rows = ROW_COUNT;
    ALTER TABLE public.store_visits ENABLE TRIGGER visits_daily_stats_trg;
    v_trigger_disabled := false;

    WITH visit_events AS (
      SELECT o.owner_id, (o.created_at AT TIME ZONE 'UTC')::DATE AS stat_date,
             NULLIF(btrim(o.payload->>'visitor_ip'), '') AS visitor_ip
      FROM public.analytics_event_outbox o
      WHERE o.id = ANY (v_ids) AND o.event_type = 'store_visit'
    ),
    visit_counts AS (
      SELECT owner_id, stat_date, COUNT(*)::INT AS visit_count FROM visit_events GROUP BY owner_id, stat_date
    ),
    new_keys AS (
      INSERT INTO public.store_visitor_daily_keys (owner_id, stat_date, visitor_ip)
      SELECT DISTINCT ve.owner_id, ve.stat_date, ve.visitor_ip FROM visit_events ve
      WHERE ve.visitor_ip IS NOT NULL AND ve.visitor_ip <> '' AND ve.visitor_ip <> '0.0.0.0'
      ON CONFLICT DO NOTHING
      RETURNING owner_id, stat_date, visitor_ip
    ),
    unique_counts AS (
      SELECT owner_id, stat_date, COUNT(*)::INT AS unique_visitors FROM new_keys GROUP BY owner_id, stat_date
    )
    INSERT INTO public.store_daily_stats (owner_id, stat_date, visit_count, unique_visitors)
    SELECT vc.owner_id, vc.stat_date, vc.visit_count, COALESCE(uc.unique_visitors, 0)
    FROM visit_counts vc
    LEFT JOIN unique_counts uc ON uc.owner_id = vc.owner_id AND uc.stat_date = vc.stat_date
    ON CONFLICT (owner_id, stat_date) DO UPDATE SET
      visit_count = store_daily_stats.visit_count + EXCLUDED.visit_count,
      unique_visitors = store_daily_stats.unique_visitors + EXCLUDED.unique_visitors,
      updated_at = NOW();
  END IF;

  INSERT INTO public.product_views (product_id, owner_id, visitor_ip, store_slug, page_path, created_at)
  SELECT (o.payload->>'product_id')::UUID, o.owner_id,
         NULLIF(btrim(o.payload->>'visitor_ip'), ''),
         NULLIF(btrim(o.payload->>'store_slug'), ''),
         NULLIF(btrim(o.payload->>'page_path'), ''),
         o.created_at
  FROM public.analytics_event_outbox o
  WHERE o.id = ANY (v_ids) AND o.event_type = 'product_view'
    AND o.payload->>'product_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  GET DIAGNOSTICS v_product_rows = ROW_COUNT;

  UPDATE public.analytics_event_outbox
  SET processed_at = NOW(), attempt_count = 0, last_error = NULL
  WHERE id = ANY (v_ids);

  v_result := jsonb_build_object(
    'processed', array_length(v_ids, 1),
    'store_visits', v_visit_rows,
    'product_views', v_product_rows,
    'owner_scope', v_scope_owner,
    'pending', (SELECT COUNT(*)::INT FROM public.analytics_event_outbox
                WHERE processed_at IS NULL AND dead_letter_at IS NULL),
    'dead_letter', (SELECT COUNT(*)::INT FROM public.analytics_event_outbox WHERE dead_letter_at IS NOT NULL)
  );

  INSERT INTO public.platform_worker_heartbeats (worker_id, last_success_at, last_result, updated_at)
  VALUES ('process_analytics_event_buffer', NOW(), v_result, NOW())
  ON CONFLICT (worker_id) DO UPDATE SET last_success_at = EXCLUDED.last_success_at, last_result = EXCLUDED.last_result, updated_at = EXCLUDED.updated_at;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    IF v_trigger_disabled THEN
      ALTER TABLE public.store_visits ENABLE TRIGGER visits_daily_stats_trg;
    END IF;
    UPDATE public.analytics_event_outbox o
    SET attempt_count = o.attempt_count + 1,
        last_error = LEFT(SQLERRM, 500),
        next_attempt_at = NOW() + (LEAST(POWER(2, LEAST(o.attempt_count + 1, 8))::INT, 300) || ' seconds')::INTERVAL,
        dead_letter_at = CASE WHEN o.attempt_count + 1 >= v_max_attempts THEN NOW() ELSE NULL END
    WHERE o.id = ANY (v_ids);

    SELECT COUNT(*)::INT INTO v_dead_lettered
    FROM public.analytics_event_outbox
    WHERE id = ANY (v_ids) AND dead_letter_at IS NOT NULL;

    v_result := jsonb_build_object(
      'success', false,
      'error', LEFT(SQLERRM, 300),
      'failed_batch', COALESCE(array_length(v_ids, 1), 0),
      'dead_lettered', v_dead_lettered
    );

    INSERT INTO public.platform_worker_heartbeats (worker_id, last_success_at, last_result, updated_at)
    VALUES ('process_analytics_event_buffer', NOW(), v_result, NOW())
    ON CONFLICT (worker_id) DO UPDATE SET last_result = EXCLUDED.last_result, updated_at = EXCLUDED.updated_at;

    RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Side effects — respect backoff schedule
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
      AND o.next_attempt_at <= NOW()
    ORDER BY o.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT * INTO v_order FROM public.orders WHERE id = v_rec.order_id AND owner_id = v_rec.owner_id;
      IF NOT FOUND THEN
        UPDATE public.order_side_effects_outbox SET processed_at = NOW(), last_error = 'order_not_found' WHERE id = v_rec.id;
        CONTINUE;
      END IF;

      v_remaining := v_rec.effects_pending;

      IF 'stats' = ANY (v_remaining) THEN
        PERFORM public.upsert_store_daily_order_stats(
          v_order.owner_id, (v_order.created_at AT TIME ZONE 'UTC')::DATE,
          COALESCE(v_order.status, 'pending'), COALESCE(v_order.total_amount, 0), 1
        );
        v_remaining := array_remove(v_remaining, 'stats');
      END IF;

      IF 'shipment' = ANY (v_remaining) AND NOT EXISTS (SELECT 1 FROM public.shipments s WHERE s.order_id = v_order.id) THEN
        INSERT INTO public.shipments (order_id, owner_id, status, delivery_fee, recipient_name, recipient_phone, delivery_address, governorate)
        VALUES (v_order.id, v_order.owner_id, 'pending', COALESCE(v_order.delivery_fee, 0),
                v_order.customer_name, v_order.customer_phone, v_order.customer_address, v_order.customer_governorate)
        RETURNING id INTO v_shipment_id;
        INSERT INTO public.shipment_tracking_events (shipment_id, status, note) VALUES (v_shipment_id, 'pending', 'تم إنشاء الشحنة');
        v_remaining := array_remove(v_remaining, 'shipment');
      ELSIF 'shipment' = ANY (v_remaining) THEN
        v_remaining := array_remove(v_remaining, 'shipment');
      END IF;

      IF 'webhook' = ANY (v_remaining) AND NOT EXISTS (
        SELECT 1 FROM public.order_webhook_outbox w WHERE w.order_id = v_order.id AND w.event_type = 'order.created'
      ) THEN
        INSERT INTO public.order_webhook_outbox (owner_id, store_id, order_id, event_type, payload)
        VALUES (v_order.owner_id, v_order.store_id, v_order.id, 'order.created',
          jsonb_build_object('order_id', v_order.id, 'owner_id', v_order.owner_id, 'store_id', v_order.store_id,
            'status', v_order.status, 'total_amount', v_order.total_amount, 'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone, 'created_at', v_order.created_at));
        v_remaining := array_remove(v_remaining, 'webhook');
      ELSIF 'webhook' = ANY (v_remaining) THEN
        v_remaining := array_remove(v_remaining, 'webhook');
      END IF;

      IF 'customer' = ANY (v_remaining) THEN
        IF EXISTS (
          SELECT 1 FROM public.customers c WHERE c.owner_id = v_order.owner_id AND c.phone = v_order.customer_phone
            AND c.last_order_date IS NOT DISTINCT FROM v_order.created_at AND c.total_orders >= 1
        ) THEN
          v_remaining := array_remove(v_remaining, 'customer');
        ELSIF EXISTS (SELECT 1 FROM public.customers c WHERE c.owner_id = v_order.owner_id AND c.phone = v_order.customer_phone) THEN
          UPDATE public.customers c SET name = COALESCE(v_order.customer_name, c.name),
            last_order_date = GREATEST(c.last_order_date, v_order.created_at),
            total_orders = c.total_orders + 1, total_spent = c.total_spent + COALESCE(v_order.total_amount, 0)
          WHERE c.owner_id = v_order.owner_id AND c.phone = v_order.customer_phone;
          v_remaining := array_remove(v_remaining, 'customer');
        ELSE
          INSERT INTO public.customers (owner_id, phone, name, first_order_date, last_order_date, total_orders, total_spent)
          VALUES (v_order.owner_id, v_order.customer_phone, v_order.customer_name, v_order.created_at, v_order.created_at, 1, v_order.total_amount);
          v_remaining := array_remove(v_remaining, 'customer');
        END IF;
      END IF;

      UPDATE public.order_side_effects_outbox
      SET effects_pending = v_remaining,
          processed_at = CASE WHEN COALESCE(array_length(v_remaining, 1), 0) = 0 THEN NOW() ELSE NULL END,
          last_error = NULL, attempt_count = 0, next_attempt_at = NOW()
      WHERE id = v_rec.id;

      IF COALESCE(array_length(v_remaining, 1), 0) = 0 THEN v_processed := v_processed + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.order_side_effects_outbox
      SET attempt_count = v_rec.attempt_count + 1,
          last_error = LEFT(SQLERRM, 500),
          next_attempt_at = NOW() + (LEAST(POWER(2, LEAST(v_rec.attempt_count + 1, 8))::INT, 300) || ' seconds')::INTERVAL,
          dead_letter_at = CASE WHEN v_rec.attempt_count + 1 >= v_max_attempts THEN NOW() ELSE NULL END
      WHERE id = v_rec.id;
      IF v_rec.attempt_count + 1 >= v_max_attempts THEN v_dead_lettered := v_dead_lettered + 1; ELSE v_failed := v_failed + 1; END IF;
    END;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true, 'processed', v_processed, 'failed', v_failed, 'dead_lettered', v_dead_lettered,
    'pending', (SELECT COUNT(*)::INT FROM public.order_side_effects_outbox WHERE processed_at IS NULL AND dead_letter_at IS NULL),
    'dead_letter', (SELECT COUNT(*)::INT FROM public.order_side_effects_outbox WHERE dead_letter_at IS NOT NULL)
  );

  INSERT INTO public.platform_worker_heartbeats (worker_id, last_success_at, last_result, updated_at)
  VALUES ('process_order_side_effects_batch', NOW(), v_result, NOW())
  ON CONFLICT (worker_id) DO UPDATE SET last_success_at = EXCLUDED.last_success_at, last_result = EXCLUDED.last_result, updated_at = EXCLUDED.updated_at;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Dead-letter replay RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retry_analytics_dead_letter(p_limit INT DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset INT;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  WITH picked AS (
    SELECT id FROM public.analytics_event_outbox
    WHERE dead_letter_at IS NOT NULL AND processed_at IS NULL
    ORDER BY dead_letter_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.analytics_event_outbox o
  SET dead_letter_at = NULL, attempt_count = 0, next_attempt_at = NOW(), last_error = NULL
  FROM picked WHERE o.id = picked.id;

  GET DIAGNOSTICS v_reset = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'reset', v_reset);
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_side_effects_dead_letter(
  p_owner_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset INT;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NOT NULL AND p_owner_id IS NOT NULL AND v_caller <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF v_caller IS NULL AND current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  WITH picked AS (
    SELECT id FROM public.order_side_effects_outbox
    WHERE dead_letter_at IS NOT NULL AND processed_at IS NULL
      AND (p_owner_id IS NULL OR owner_id = p_owner_id)
    ORDER BY dead_letter_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.order_side_effects_outbox o
  SET dead_letter_at = NULL, attempt_count = 0, next_attempt_at = NOW(), last_error = NULL
  FROM picked WHERE o.id = picked.id;

  GET DIAGNOSTICS v_reset = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'reset', v_reset, 'owner_id', COALESCE(p_owner_id, v_caller));
END;
$$;

REVOKE ALL ON FUNCTION public.retry_analytics_dead_letter(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_analytics_dead_letter(INT) TO service_role;

REVOKE ALL ON FUNCTION public.retry_side_effects_dead_letter(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_side_effects_dead_letter(UUID, INT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Import job stuck recovery
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recover_stale_import_jobs(p_stale_minutes INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset INT := 0;
  v_stale INT := GREATEST(COALESCE(p_stale_minutes, 30), 5);
BEGIN
  IF NOT public._platform_table_exists('import_jobs') THEN
    RETURN jsonb_build_object('success', true, 'reset', 0, 'skipped', 'no_table');
  END IF;

  UPDATE public.import_jobs
  SET status = 'pending', started_at = NULL
  WHERE status = 'processing'
    AND started_at IS NOT NULL
    AND started_at < NOW() - (v_stale || ' minutes')::INTERVAL;

  GET DIAGNOSTICS v_reset = ROW_COUNT;

  INSERT INTO public.platform_worker_heartbeats (worker_id, last_success_at, last_result, updated_at)
  VALUES ('recover_stale_import_jobs', NOW(), jsonb_build_object('reset', v_reset), NOW())
  ON CONFLICT (worker_id) DO UPDATE SET last_success_at = EXCLUDED.last_success_at, last_result = EXCLUDED.last_result, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('success', true, 'reset', v_reset, 'stale_minutes', v_stale);
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stale_import_jobs(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_import_jobs(INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 7) Unified queue health audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_queue_health_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_analytics JSONB;
  v_side JSONB;
  v_webhook_stale INT := 0;
  v_import_stuck INT := 0;
  v_worker_stale_threshold INTERVAL := INTERVAL '10 minutes';
  v_critical BOOLEAN := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  v_analytics := public.analytics_outbox_backlog_health();
  v_side := public.side_effects_outbox_backlog_health();

  SELECT COUNT(*)::INT INTO v_webhook_stale
  FROM public.order_webhook_outbox
  WHERE status = 'processing' AND created_at < NOW() - INTERVAL '15 minutes';

  IF public._platform_table_exists('import_jobs') THEN
    SELECT COUNT(*)::INT INTO v_import_stuck
    FROM public.import_jobs
    WHERE status = 'processing' AND started_at IS NOT NULL AND started_at < NOW() - INTERVAL '30 minutes';
  END IF;

  v_critical :=
    COALESCE((v_analytics->>'critical')::boolean, false)
    OR COALESCE((v_side->>'critical')::boolean, false)
    OR (
      COALESCE((v_analytics->>'pending')::int, 0) > 0
      AND (v_analytics->>'worker_stale_minutes') IS NOT NULL
      AND (v_analytics->>'worker_stale_minutes')::numeric > 10
    )
    OR (
      COALESCE((v_side->>'pending')::int, 0) > 0
      AND (v_side->>'worker_stale_minutes') IS NOT NULL
      AND (v_side->>'worker_stale_minutes')::numeric > 10
    )
    OR v_webhook_stale > 0
    OR v_import_stuck > 0;

  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'critical', v_critical,
    'analytics', v_analytics,
    'side_effects', v_side,
    'webhooks', jsonb_build_object(
      'stale_processing', v_webhook_stale,
      'failed', (SELECT COUNT(*)::INT FROM public.order_webhook_outbox WHERE status = 'failed'),
      'pending', (SELECT COUNT(*)::INT FROM public.order_webhook_outbox WHERE status = 'pending')
    ),
    'import_jobs', jsonb_build_object('stuck_processing', v_import_stuck),
    'recommendations',
      CASE WHEN v_critical THEN jsonb_build_array(
        'invoke process-background-queue edge worker',
        'verify pg_cron schedules for analytics + side effects',
        'review dead_letter queues — retry_side_effects_dead_letter / retry_analytics_dead_letter'
      ) ELSE '[]'::jsonb END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_queue_health_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_queue_health_audit() TO service_role;

-- ---------------------------------------------------------------------------
-- 8) Enhanced analytics backlog health (worker heartbeat + dead-letter)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_outbox_backlog_health()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending INT;
  v_oldest_minutes NUMERIC;
  v_dead_letter INT;
  v_last_run TIMESTAMPTZ;
  v_processed_60s INT;
BEGIN
  SELECT COUNT(*)::INT,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 60.0, 0)
    INTO v_pending, v_oldest_minutes
  FROM public.analytics_event_outbox
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

  SELECT COUNT(*)::INT INTO v_dead_letter
  FROM public.analytics_event_outbox WHERE dead_letter_at IS NOT NULL;

  SELECT last_success_at INTO v_last_run
  FROM public.platform_worker_heartbeats WHERE worker_id = 'process_analytics_event_buffer';

  SELECT COUNT(*)::INT INTO v_processed_60s
  FROM public.analytics_event_outbox
  WHERE processed_at IS NOT NULL AND processed_at >= NOW() - INTERVAL '60 seconds';

  RETURN jsonb_build_object(
    'pending', v_pending,
    'oldest_minutes', ROUND(v_oldest_minutes, 1),
    'dead_letter', v_dead_letter,
    'processed_last_60s', v_processed_60s,
    'last_worker_success_at', v_last_run,
    'worker_stale_minutes',
      CASE WHEN v_last_run IS NULL THEN NULL
           ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - v_last_run)) / 60.0, 1) END,
    'healthy', v_pending < 500 AND v_oldest_minutes < 15 AND v_dead_letter = 0,
    'warning', v_pending >= 500 OR v_oldest_minutes >= 15 OR v_dead_letter > 0,
    'critical', v_pending >= 2000 OR v_oldest_minutes >= 60 OR v_dead_letter >= 50
      OR (v_pending > 0 AND v_last_run IS NOT NULL AND v_last_run < NOW() - INTERVAL '10 minutes')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) get_background_jobs_status — exclude dead-letter from pending; worker stale
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

  IF v_analytics_pending >= 5000 OR v_webhook_pending >= 500 OR v_webhook_failed >= 100
     OR v_side_pending >= 1000 OR v_analytics_stale OR v_side_stale THEN
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
    'unified_worker', 'process-background-queue',
    'recommendations',
      CASE
        WHEN v_analytics_stale OR v_side_stale THEN jsonb_build_array('CRITICAL: background worker stale — invoke process-background-queue immediately')
        WHEN v_side_dead > 0 THEN jsonb_build_array('retry_side_effects_dead_letter for failed checkout side effects')
        WHEN v_analytics_dead > 0 THEN jsonb_build_array('retry_analytics_dead_letter for poison analytics events')
        WHEN v_side_pending > 0 AND v_side_oldest > 120 THEN jsonb_build_array('invoke process_order_side_effects_batch')
        WHEN v_webhook_failed >= 50 THEN jsonb_build_array('retry_order_webhook_events')
        WHEN v_analytics_pending > 0 AND v_analytics_oldest > 120 THEN jsonb_build_array('run process_analytics_event_buffer')
        ELSE '[]'::jsonb
      END
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 10) Background worker bundle — import recovery + auto DLQ retry hint
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
BEGIN
  PERFORM set_config('statement_timeout', '60000', true);
  PERFORM set_config('lock_timeout', '10000', true);

  v_side := public.process_order_side_effects_batch(v_limit);
  v_analytics := public.process_analytics_event_buffer(LEAST(v_limit * 4, 500));
  v_recovery := public.recover_stale_webhook_processing(GREATEST(COALESCE(p_stale_webhook_minutes, 15), 5));
  v_import := public.recover_stale_import_jobs(30);
  v_lifecycle := public.platform_run_data_lifecycle();
  v_health := public.platform_queue_health_audit();

  RETURN jsonb_build_object(
    'success', true,
    'ran_at', now(),
    'side_effects', v_side,
    'analytics', v_analytics,
    'webhook_recovery', v_recovery,
    'import_recovery', v_import,
    'lifecycle', v_lifecycle,
    'health', v_health
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', LEFT(SQLERRM, 300));
END;
$$;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (111, 'queue hardening: DLQ, backoff, worker stale detection, import recovery, unified health audit')
ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes, applied_at = NOW();
