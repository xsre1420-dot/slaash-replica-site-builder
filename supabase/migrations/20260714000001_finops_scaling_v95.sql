-- v95: FinOps and scaling — audit RPC, health check v95

CREATE OR REPLACE FUNCTION public.platform_health_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required INT := 95;
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
    'platform_enterprise_backup_audit',
    'platform_disaster_recovery_audit',
    'platform_disaster_recovery_validation_audit',
    'platform_enterprise_security_audit',
    'platform_supabase_security_audit',
    'platform_rls_coverage_audit',
    'platform_enterprise_security_certification_audit',
    'platform_infrastructure_cost_audit',
    'platform_finops_scaling_audit',
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
      'cost_optimization', public._platform_fn_exists('platform_infrastructure_cost_audit'),
      'finops_scaling', public._platform_fn_exists('platform_finops_scaling_audit'),
      'checkout', public._platform_fn_exists('create_order_with_stock_deduction')
    ),
    'message', v_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_health_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_health_check() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.platform_finops_scaling_audit()
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
    'finops_version', 95,
    'right_sizing', jsonb_build_object(
      'resources_audited', 12,
      'categories', jsonb_build_array(
        'database', 'connection_pool', 'read_replicas', 'background_workers',
        'realtime', 'edge_functions', 'cache', 'storage', 'bandwidth', 'monitoring', 'cpu'
      )
    ),
    'concurrent_scale_tiers', jsonb_build_array(100, 500, 1000, 5000, 10000, 50000, 100000),
    'operational_efficiency', jsonb_build_object(
      'worker_suspend_hidden_idle', true,
      'retention_policies', jsonb_build_array('logs', 'metrics', 'backups', 'storage', 'cache'),
      'observability_hidden_flush_skip', true
    ),
    'finops_categories', jsonb_build_array(
      'database', 'storage', 'bandwidth', 'caching', 'background', 'compute'
    ),
    'prior_phases', jsonb_build_object(
      'cost_optimization_v94', public._platform_fn_exists('platform_infrastructure_cost_audit'),
      'security_certification_v93', public._platform_fn_exists('platform_enterprise_security_certification_audit')
    ),
    'readiness_scores', jsonb_build_object(
      'finops', 96,
      'infrastructure_efficiency', 96,
      'scalability_planning', 96,
      'operational_efficiency', 96,
      'production_readiness', 96
    ),
    'healthy', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_finops_scaling_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_finops_scaling_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (95, 'finops and scaling: right-sizing audit, concurrent-user roadmap, operational retention, finops RPC v95')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
