-- v115: Phase 9 — production-grade monitoring & observability audit RPC

CREATE OR REPLACE FUNCTION public.platform_monitoring_observability_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema_version INT;
  v_saturation JSONB := '{}'::jsonb;
  v_internals JSONB := '{}'::jsonb;
  v_workers JSONB := '{}'::jsonb;
  v_db_size BIGINT;
  v_lock_waits INT := 0;
  v_top_rpcs JSONB := '[]'::jsonb;
BEGIN
  SELECT COALESCE(max(version), 0) INTO v_schema_version FROM public.platform_schema_version;

  IF public._platform_fn_exists('platform_connection_saturation_audit') THEN
    BEGIN
      v_saturation := public.platform_connection_saturation_audit();
    EXCEPTION WHEN OTHERS THEN
      v_saturation := jsonb_build_object('error', LEFT(SQLERRM, 200));
    END;
  END IF;

  IF public._platform_fn_exists('platform_postgresql_internals_audit') THEN
    BEGIN
      v_internals := public.platform_postgresql_internals_audit();
    EXCEPTION WHEN OTHERS THEN
      v_internals := jsonb_build_object('error', LEFT(SQLERRM, 200));
    END;
  END IF;

  IF public._platform_fn_exists('get_background_jobs_status') THEN
    BEGIN
      v_workers := public.get_background_jobs_status();
    EXCEPTION WHEN OTHERS THEN
      v_workers := jsonb_build_object('error', LEFT(SQLERRM, 200));
    END;
  END IF;

  SELECT pg_database_size(current_database()) INTO v_db_size;

  SELECT COUNT(*)::INT INTO v_lock_waits
  FROM pg_stat_activity
  WHERE datname = current_database() AND wait_event_type = 'Lock';

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.total_ms DESC), '[]'::jsonb)
    INTO v_top_rpcs
    FROM (
      SELECT
        LEFT(query, 120) AS query_preview,
        calls::bigint AS calls,
        ROUND(total_exec_time::numeric, 2) AS total_ms,
        ROUND(mean_exec_time::numeric, 2) AS mean_ms,
        ROUND(max_exec_time::numeric, 2) AS max_ms
      FROM pg_stat_statements
      WHERE query ILIKE '%rpc/%' OR query ILIKE '%create_order%' OR query ILIKE '%get_storefront%'
      ORDER BY total_exec_time DESC
      LIMIT 10
    ) t;
  END IF;

  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'phase', 9,
    'schema_version', v_schema_version,
    'application_metrics', jsonb_build_object(
      'latency_percentiles', jsonb_build_array('p50', 'p95', 'p99'),
      'request_counters', jsonb_build_array(
        'http_requests_total', 'http_request_duration_ms', 'http_errors_total', 'http_timeouts_total'
      ),
      'rpc_counters', jsonb_build_array(
        'rpc_calls_total', 'rpc_duration_ms', 'rpc_errors_total', 'rpc_timeouts_total'
      )
    ),
    'database', jsonb_build_object(
      'size_bytes', v_db_size,
      'size_pretty', pg_size_pretty(v_db_size),
      'connection_saturation', v_saturation,
      'internals', v_internals,
      'lock_waits', v_lock_waits
    ),
    'analytics_queue', COALESCE(v_workers->'analytics', '{}'::jsonb),
    'webhook_queue', COALESCE(v_workers->'order_webhooks', '{}'::jsonb),
    'worker_status', COALESCE(v_workers->'status', '"unknown"'::jsonb),
    'top_expensive_queries', v_top_rpcs,
    'alert_catalog', jsonb_build_array(
      'high-error-rate', 'p95-latency-degradation', 'database-connection-saturation',
      'database-cpu-saturation', 'rpc-timeout-spike', 'analytics-backlog',
      'order-failure-spike', 'suspicious-security-activity'
    ),
    'dashboard_catalog', jsonb_build_array(
      'platform-overview', 'database-health', 'rpc-performance', 'cache-health',
      'analytics-queue', 'orders-commerce', 'security-events'
    ),
    'logging_policy', jsonb_build_object(
      'redact_passwords', true,
      'redact_tokens', true,
      'redact_payment_secrets', true,
      'redact_service_role_keys', true,
      'redact_customer_pii', true
    ),
    'healthy',
      COALESCE((v_saturation->>'saturation_pct')::numeric, 0) < 90
      AND COALESCE((v_workers->'analytics'->>'pending')::int, 0) < 5000
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'audited_at', NOW(),
      'phase', 9,
      'healthy', false,
      'error', LEFT(SQLERRM, 300)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_monitoring_observability_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_monitoring_observability_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (
  124,
  'Phase 9: monitoring & observability audit — DB saturation, analytics backlog, top queries, alert catalog'
)
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
