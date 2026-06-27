-- v74 / Phase 1.4: Enterprise connection pool & database resource optimization
-- Single-connection background bundle, resource audit extensions, connection benchmarks

-- ---------------------------------------------------------------------------
-- 1) Background worker bundle — one RPC / one DB connection per edge invocation
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
  v_lifecycle JSONB;
BEGIN
  PERFORM set_config('statement_timeout', '60000', true);
  PERFORM set_config('lock_timeout', '10000', true);

  v_side := public.process_order_side_effects_batch(v_limit);
  v_analytics := public.process_analytics_event_buffer(LEAST(v_limit * 4, 500));
  v_recovery := public.recover_stale_webhook_processing(
    GREATEST(COALESCE(p_stale_webhook_minutes, 15), 5)
  );
  v_lifecycle := public.platform_run_data_lifecycle();

  RETURN jsonb_build_object(
    'success', true,
    'ran_at', now(),
    'side_effects', v_side,
    'analytics', v_analytics,
    'webhook_recovery', v_recovery,
    'lifecycle', v_lifecycle
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', LEFT(SQLERRM, 300));
END;
$$;

REVOKE ALL ON FUNCTION public.process_background_worker_bundle(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_background_worker_bundle(INT, INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Connection pool recommendations (production sizing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_connection_pool_recommendations()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_conn INT;
  v_active INT;
  v_total INT;
  v_saturation NUMERIC;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT setting::INT INTO v_max_conn FROM pg_settings WHERE name = 'max_connections';

  SELECT COUNT(*) FILTER (WHERE state = 'active')::INT,
         COUNT(*)::INT
  INTO v_active, v_total
  FROM pg_stat_activity
  WHERE datname = current_database();

  v_saturation := CASE WHEN v_max_conn > 0 THEN ROUND((v_total::numeric / v_max_conn) * 100, 1) ELSE 0 END;

  RETURN jsonb_build_object(
    'success', true,
    'phase', '1.4',
    'audited_at', now(),
    'current', jsonb_build_object(
      'max_connections', v_max_conn,
      'total_connections', v_total,
      'active_connections', v_active,
      'saturation_pct', v_saturation
    ),
    'supavisor', jsonb_build_object(
      'mode', 'transaction',
      'pool_size_recommended', LEAST(GREATEST(ceil(v_max_conn * 0.4)::INT, 15), 80),
      'default_pool_size', 20,
      'max_client_conn', 1000,
      'notes', 'Use transaction mode on port 6543 for PostgREST / serverless; session mode only for prepared statements'
    ),
    'timeouts_ms', jsonb_build_object(
      'statement_timeout_checkout', 20000,
      'statement_timeout_batch', 45000,
      'lock_timeout_checkout', 8000,
      'lock_timeout_merchant_rpc', 4000,
      'idle_in_transaction_session_timeout', 60000
    ),
    'client', jsonb_build_object(
      'singleton_supabase_client', true,
      'http_keepalive', true,
      'read_replica_for_stable_rpcs', true,
      'background_worker_bundle_rpc', true,
      'unified_realtime_channel', true
    ),
    'scaling_tiers', jsonb_build_array(
      jsonb_build_object('concurrent_users', 100, 'pool_size', 15, 'read_replica', 'optional'),
      jsonb_build_object('concurrent_users', 500, 'pool_size', 25, 'read_replica', 'recommended'),
      jsonb_build_object('concurrent_users', 1000, 'pool_size', 40, 'read_replica', 'required'),
      jsonb_build_object('concurrent_users', 2000, 'pool_size', 60, 'read_replica', 'required'),
      jsonb_build_object('concurrent_users', 5000, 'pool_size', 80, 'read_replica', 'required')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_connection_pool_recommendations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_connection_pool_recommendations() TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Resource audit — extended pool / buffer / wait metrics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_database_resource_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_conn INT;
  v_result JSONB;
  v_total INT;
  v_idle_in_tx INT;
  v_waiting INT;
  v_saturation NUMERIC;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT setting::INT INTO v_max_conn FROM pg_settings WHERE name = 'max_connections';

  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE state = 'idle in transaction')::INT,
    COUNT(*) FILTER (WHERE wait_event_type = 'Lock')::INT
  INTO v_total, v_idle_in_tx, v_waiting
  FROM pg_stat_activity
  WHERE datname = current_database();

  v_saturation := CASE WHEN v_max_conn > 0 THEN ROUND((v_total::numeric / v_max_conn) * 100, 1) ELSE 0 END;

  SELECT jsonb_build_object(
    'success', true,
    'audited_at', now(),
    'phase', '1.4',
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'max_connections', v_max_conn,
    'pool_saturation_pct', v_saturation,
    'connections', (
      SELECT jsonb_build_object(
        'total', COUNT(*)::INT,
        'active', COUNT(*) FILTER (WHERE state = 'active')::INT,
        'idle', COUNT(*) FILTER (WHERE state = 'idle')::INT,
        'idle_in_transaction', COUNT(*) FILTER (WHERE state = 'idle in transaction')::INT,
        'waiting', COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL AND wait_event_type <> 'Client')::INT
      )
      FROM pg_stat_activity
      WHERE datname = current_database()
    ),
    'by_application', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.connections DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(application_name, 'unknown') AS application_name,
               COUNT(*)::INT AS connections,
               COUNT(*) FILTER (WHERE state = 'idle in transaction')::INT AS idle_in_tx
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY 1
        ORDER BY COUNT(*) DESC
        LIMIT 15
      ) t
    ),
    'wait_events', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.cnt DESC), '[]'::jsonb)
      FROM (
        SELECT wait_event_type, wait_event, COUNT(*)::INT AS cnt
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type IS NOT NULL
          AND wait_event_type <> 'Client'
        GROUP BY 1, 2
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) t
    ),
    'long_transactions', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT pid, state, application_name,
               EXTRACT(EPOCH FROM (NOW() - xact_start))::INT AS xact_seconds,
               LEFT(query, 120) AS query_preview
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND xact_start IS NOT NULL
          AND NOW() - xact_start > INTERVAL '5 seconds'
        ORDER BY xact_start
        LIMIT 10
      ) t
    ),
    'lock_waits', v_waiting,
    'database_io', (
      SELECT jsonb_build_object(
        'blks_read', SUM(blks_read)::BIGINT,
        'blks_hit', SUM(blks_hit)::BIGINT,
        'cache_hit_ratio',
          CASE WHEN SUM(blks_hit + blks_read) > 0
            THEN ROUND(100.0 * SUM(blks_hit) / SUM(blks_hit + blks_read), 2)
            ELSE 100
          END,
        'temp_files', SUM(temp_files)::BIGINT,
        'deadlocks', SUM(deadlocks)::BIGINT,
        'conflicts', SUM(conflicts)::BIGINT
      )
      FROM pg_stat_database
      WHERE datname = current_database()
    ),
    'outbox_backlog', jsonb_build_object(
      'analytics', (SELECT COUNT(*)::INT FROM public.analytics_event_outbox WHERE processed_at IS NULL),
      'order_side_effects', (SELECT COUNT(*)::INT FROM public.order_side_effects_outbox WHERE processed_at IS NULL),
      'webhooks', (SELECT COUNT(*)::INT FROM public.order_webhook_outbox WHERE status = 'pending')
    ),
    'background_worker_bundle', EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'process_background_worker_bundle'
    ),
    'healthy',
      v_idle_in_tx < 5
      AND v_saturation < 85
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_background_worker_bundle')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Connection benchmark — round-trip + resource snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_connection_benchmark(
  p_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_results JSONB := '[]'::jsonb;
  v_start TIMESTAMPTZ;
  v_ms NUMERIC;
  v_rec RECORD;
  v_owner UUID;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'authenticator') THEN
    RAISE EXCEPTION 'service_role or postgres only';
  END IF;

  SELECT ss.store_slug, ss.owner_id INTO v_slug, v_owner
  FROM public.store_settings ss
  WHERE ss.store_slug IS NOT NULL
  ORDER BY ss.updated_at DESC NULLS LAST
  LIMIT 1;

  v_slug := COALESCE(NULLIF(trim(p_slug), ''), v_slug, 'demo-store');

  FOR v_rec IN
    SELECT * FROM (VALUES
      ('storefront_page_bundle'),
      ('store_products_page'),
      ('dashboard_batch'),
      ('background_worker_bundle_dry')
    ) AS t(name)
  LOOP
    v_start := clock_timestamp();
    BEGIN
      IF v_rec.name = 'storefront_page_bundle' THEN
        PERFORM public.get_storefront_page_bundle(v_slug, 12, '', '', '');
      ELSIF v_rec.name = 'store_products_page' THEN
        PERFORM public.get_store_products_page(v_slug, 12, NULL, NULL, NULL);
      ELSIF v_rec.name = 'dashboard_batch' AND v_owner IS NOT NULL THEN
        PERFORM public.get_dashboard_statistics_batch(v_owner);
      ELSIF v_rec.name = 'background_worker_bundle_dry' THEN
        PERFORM public.process_order_side_effects_batch(1);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'name', v_rec.name, 'error', SQLERRM
      ));
      CONTINUE;
    END;

    v_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::numeric;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'name', v_rec.name,
      'round_trip_ms', ROUND(v_ms, 3)
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'benchmark_at', now(),
    'phase', '1.4',
    'slug', v_slug,
    'owner_id', v_owner,
    'paths', v_results,
    'resource_audit', public.platform_database_resource_audit(),
    'pool_recommendations', public.platform_connection_pool_recommendations()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_connection_benchmark(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_connection_benchmark(TEXT) TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (74, 'connection_pool phase 1.4: worker bundle RPC, resource audit, pool recommendations')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
