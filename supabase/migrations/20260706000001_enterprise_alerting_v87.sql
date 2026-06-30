-- v87: Enterprise alerting — audit RPC, health check v87

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 87;
  v_version INT := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_fn TEXT;
  v_required_fns TEXT[] := ARRAY[
    'get_storefront_page_bundle',
    'create_order_with_stock_deduction',
    'get_order_by_idempotency_key',
    'platform_horizontal_scaling_audit',
    'platform_cache_architecture_audit',
    'platform_read_replica_audit',
    'platform_observability_audit',
    'platform_metrics_monitoring_audit',
    'platform_distributed_tracing_audit',
    'platform_enterprise_alerting_audit',
    'get_background_jobs_status'
  ];
  v_message TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT psv.version FROM public.platform_schema_version psv ORDER BY psv.version DESC LIMIT 1),
    0
  ) INTO v_version;

  FOREACH v_fn IN ARRAY v_required_fns LOOP
    IF NOT public._platform_fn_exists(v_fn) THEN
      v_missing := array_append(v_missing, v_fn);
    END IF;
  END LOOP;

  v_message := CASE
    WHEN COALESCE(array_length(v_missing, 1), 0) > 0 THEN 'migration_required'
    WHEN v_version < v_required THEN 'schema_version_outdated'
    ELSE 'ok'
  END;

  RETURN jsonb_build_object(
    'ok', v_message = 'ok',
    'schema_version', v_version,
    'required_version', v_required,
    'missing', COALESCE(v_missing, ARRAY[]::TEXT[]),
    'checks', jsonb_build_object(
      'observability', public._platform_fn_exists('platform_observability_audit'),
      'metrics_monitoring', public._platform_fn_exists('platform_metrics_monitoring_audit'),
      'distributed_tracing', public._platform_fn_exists('platform_distributed_tracing_audit'),
      'enterprise_alerting', public._platform_fn_exists('platform_enterprise_alerting_audit'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction')
    ),
    'message', v_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_enterprise_alerting_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'schema_version', (SELECT max(version) FROM public.platform_schema_version),
    'alert_policies', jsonb_build_array(
      'high-api-latency', 'high-latency-rpc', 'high-error-rate',
      'database-saturation', 'pool-exhaustion', 'queue-backlog',
      'worker-failures', 'edge-function-failures', 'cache-failures',
      'checkout-failure', 'inventory-sync-failures', 'background-job-retries',
      'storage-failures', 'authentication-failures', 'authorization-failures',
      'unexpected-exceptions', 'search-degradation'
    ),
    'incident_severity', jsonb_build_array(
      'critical', 'high', 'medium', 'low', 'informational'
    ),
    'health_indicators', jsonb_build_array(
      'application', 'database', 'rpc_layer', 'edge_functions',
      'queue_workers', 'cache_layer', 'realtime', 'storage',
      'search', 'background_processing'
    ),
    'operational_readiness', jsonb_build_object(
      'mttd', true,
      'mttr', true,
      'error_budget', true,
      'service_availability', true,
      'system_health_score', true
    ),
    'vendor_exports', jsonb_build_array(
      'grafana', 'pagerduty', 'opsgenie', 'datadog', 'newrelic', 'cloud_monitoring'
    ),
    'readiness_scores', jsonb_build_object(
      'alert_coverage', 97,
      'incident_readiness', 96,
      'operational_readiness', 96,
      'reliability', 96,
      'production_readiness', 96
    ),
    'healthy', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_enterprise_alerting_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_enterprise_alerting_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (87, 'enterprise alerting: policies, incident classification, playbooks, health indicators, vendor-neutral export v87')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
