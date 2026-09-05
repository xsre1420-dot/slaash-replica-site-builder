-- v114: Phase 8 — backup, recovery, and disaster-recovery readiness marker + audit RPC

CREATE OR REPLACE FUNCTION public.platform_backup_recovery_readiness_audit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_migration_count INT;
  v_schema_version INT;
  v_orders BIGINT;
  v_orders_with_idempotency BIGINT;
BEGIN
  SELECT COUNT(*)::INT
  INTO v_migration_count
  FROM supabase_migrations.schema_migrations
  WHERE version IS NOT NULL;

  SELECT COALESCE(max(version), 0)
  INTO v_schema_version
  FROM public.platform_schema_version;

  SELECT COUNT(*) INTO v_orders FROM public.orders;
  SELECT COUNT(*) INTO v_orders_with_idempotency
  FROM public.orders
  WHERE idempotency_key IS NOT NULL AND trim(idempotency_key) <> '';

  RETURN jsonb_build_object(
    'audited_at', NOW(),
    'phase', 8,
    'schema_version', v_schema_version,
    'migration_files_applied', v_migration_count,
    'backup_infrastructure', jsonb_build_object(
      'enterprise_backup_audit', public._platform_fn_exists('platform_enterprise_backup_audit'),
      'disaster_recovery_audit', public._platform_fn_exists('platform_disaster_recovery_audit'),
      'dr_validation_audit', public._platform_fn_exists('platform_disaster_recovery_validation_audit'),
      'health_check', public._platform_fn_exists('platform_health_check')
    ),
    'critical_data', jsonb_build_object(
      'orders_total', v_orders,
      'orders_with_idempotency_key', v_orders_with_idempotency,
      'idempotency_coverage_pct', CASE WHEN v_orders > 0
        THEN round(100.0 * v_orders_with_idempotency / v_orders, 2)
        ELSE 100 END
    ),
    'recovery_objectives', jsonb_build_object(
      'global_rpo_minutes', 60,
      'global_rto_minutes', 30,
      'tier1_checkout_rpo_minutes', 1,
      'tier1_checkout_rto_minutes', 15,
      'pitr_rpo_minutes', 1,
      'pitr_retention_days', 7
    ),
    'retention_policy', jsonb_build_object(
      'daily_full_backup_days', 30,
      'weekly_full_backup_days', 90,
      'wal_incremental_days', 7,
      'pitr_window_days', 7,
      'storage_versioning_days', 365
    ),
    'recovery_independence', jsonb_build_object(
      'backups_managed_by_supabase', true,
      'logical_dump_script', 'scripts/backup-database.sh',
      'restore_script', 'scripts/restore-database.sh',
      'safe_restore_test', 'scripts/safe-restore-test.mjs',
      'requires_staging_not_production', true
    ),
    'healthy', public._platform_fn_exists('platform_health_check')
      AND public._platform_fn_exists('platform_disaster_recovery_audit')
  );
EXCEPTION
  WHEN undefined_table THEN
    RETURN jsonb_build_object(
      'audited_at', NOW(),
      'phase', 8,
      'healthy', false,
      'error', 'schema_migrations_table_unavailable'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_backup_recovery_readiness_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_backup_recovery_readiness_audit() TO service_role;

INSERT INTO public.platform_schema_version (version, notes)
VALUES (
  123,
  'Phase 8: backup/recovery readiness audit RPC — RPO/RTO documentation, order idempotency coverage'
)
ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), notes = EXCLUDED.notes;
