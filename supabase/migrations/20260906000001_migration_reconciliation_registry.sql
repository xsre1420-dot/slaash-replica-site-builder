-- Migration reconciliation registry (metadata only — no business logic changes)
-- Establishes a durable, queryable record of deferred/blocked/non-linear migrations.

CREATE TABLE IF NOT EXISTS public.platform_migration_registry (
  version TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('applied', 'deferred', 'blocked', 'history_repair', 'superseded')),
  wave TEXT,
  file_name TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_migration_registry IS
  'Canonical migration classification for selective production deployments. Repo source: supabase/migration-manifest.json';

REVOKE ALL ON TABLE public.platform_migration_registry FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.platform_migration_registry TO service_role;

CREATE OR REPLACE FUNCTION public.platform_migration_registry_snapshot()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'version', version,
        'status', status,
        'wave', wave,
        'file_name', file_name,
        'notes', notes,
        'updated_at', updated_at
      )
      ORDER BY version
    ),
    '[]'::jsonb
  )
  FROM public.platform_migration_registry;
$$;

REVOKE ALL ON FUNCTION public.platform_migration_registry_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_migration_registry_snapshot() TO service_role;

INSERT INTO public.platform_migration_registry (version, status, wave, file_name, notes) VALUES
  ('20260731000002', 'blocked', NULL, '20260731000002_analytics_visit_count_fix.sql.blocked',
   'Permanently blocked — sync analytics flush on hot path. Replaced by 20260829000001 and 20260902160000.'),
  ('20260728000001', 'deferred', 'premium-inventory', '20260728000001_inventory_premium_platform.sql',
   'Premium warehouse/PO inventory — skipped when 20260730000001 applied out of order.'),
  ('20260731000003', 'deferred', 'order-workflow', '20260731000003_simplified_order_workflow.sql',
   'Simplified merchant order workflow.'),
  ('20260801000001', 'deferred', 'meta-tracking', '20260801000001_meta_tracking_enterprise.sql',
   'Enterprise Meta CAPI tracking.'),
  ('20260803000001', 'deferred', 'preview-access', '20260803000001_preview_merchant_access_code.sql',
   'Preview merchant access code flow.'),
  ('20260804000001', 'deferred', 'subscription-reliability', '20260804000001_subscription_reliability_fixes.sql',
   'Subscription billing reliability fixes.'),
  ('20260805000001', 'deferred', 'lead-pipeline', '20260805000001_lead_completed_pipeline.sql',
   'Lead completed conversion pipeline.'),
  ('20260902000003', 'deferred', 'phase-3.4-dashboard', '20260902000003_dashboard_statistics_phase_3_4.sql',
   'Dashboard/statistics RPC bundle optimization.'),
  ('20260902000004', 'deferred', 'phase-3.5-inventory', '20260902000004_inventory_read_optimization_phase_3_5.sql',
   'Merchant inventory page read bundle.'),
  ('20260902000005', 'deferred', 'phase-3.6-checkout', '20260902000005_checkout_concurrency_phase_3_6.sql',
   'Checkout concurrency — requires explicit ops approval.'),
  ('20260902000006', 'deferred', 'phase-4-connection-pool', '20260902000006_connection_pool_phase_4.sql',
   'Connection pool observability.'),
  ('20260902000008', 'deferred', 'phase-6-reliability', '20260902000008_production_reliability_phase_6.sql',
   'Production reliability guardrails.'),
  ('20260902000009', 'deferred', 'phase-7-tenant-isolation', '20260902000009_tenant_isolation_security_phase_7.sql',
   'Tenant isolation and analytics buffer hardening.'),
  ('20260902000010', 'deferred', 'phase-8-backup', '20260902000010_backup_recovery_phase_8.sql',
   'Backup/recovery playbooks.'),
  ('20260902000011', 'deferred', 'phase-9-monitoring', '20260902000011_monitoring_observability_phase_9.sql',
   'Platform monitoring observability audit RPCs.'),
  ('20260905000001', 'history_repair', 'phase-4.1-slo', '20260905000001_checkout_phase_4_1_slo_monitoring.sql',
   'SLO snapshot RPC applied out-of-band; history repaired via migration repair.')
ON CONFLICT (version) DO UPDATE SET
  status = EXCLUDED.status,
  wave = EXCLUDED.wave,
  file_name = EXCLUDED.file_name,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO public.platform_schema_version (version, notes)
VALUES (106, 'Migration reconciliation registry — deferred/blocked/non-linear state documented')
ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes;
