/**
 * Phase 3 — Documented restore procedures per subsystem.
 */
export type RestoreProcedure = {
  id: string;
  domain:
    | 'database'
    | 'storage'
    | 'configuration'
    | 'secrets'
    | 'environment'
    | 'background_queues'
    | 'edge_functions'
    | 'application';
  title: string;
  estimatedMinutes: number;
  prerequisites: string[];
  steps: string[];
  verification: string[];
  rollback: string[];
};

export const RESTORE_PROCEDURES: RestoreProcedure[] = [
  {
    id: 'restore-database-full',
    domain: 'database',
    title: 'Database Full Restore',
    estimatedMinutes: 60,
    prerequisites: [
      'Latest verified backup (scripts/backup-database.sh output or Supabase PITR)',
      'Staging or recovery Supabase project linked',
      'Service role key for post-restore health check',
    ],
    steps: [
      'Identify recovery point: PITR timestamp or backup file stamp',
      'If PITR: Supabase Dashboard → Database → Backups → Restore to point in time',
      'If full dump: ./scripts/restore-database.sh backups/db-backup-<stamp>.sql',
      'Apply pending migrations if restoring to empty project: supabase db push',
      'Verify platform_schema_version matches expected (v89+)',
      'Run platform_health_check() — expect ok',
    ],
    verification: [
      'Row counts on orders, products, stores within 1% of pre-incident',
      'create_order_with_stock_deduction smoke test on staging',
      'get_background_jobs_status() returns expected queue depth',
    ],
    rollback: [
      'If restore corrupts data: re-restore from earlier backup',
      'Document incident timeline in supabase/chaos-reports/',
    ],
  },
  {
    id: 'restore-storage-buckets',
    domain: 'storage',
    title: 'Storage Bucket Restore',
    estimatedMinutes: 120,
    prerequisites: ['Replica bucket or backup export access', 'Bucket policy documentation'],
    steps: [
      'Identify affected buckets (product-images, store-assets, media, documents, user-uploads)',
      'List objects at last known-good replication timestamp',
      'Restore from cross-region replica or backup archive',
      'Reconcile missing objects via checksum/ETag comparison',
      'Update CDN cache invalidation for restored paths',
      'Verify storefront image URLs resolve',
    ],
    verification: [
      'Sample 20 product images load with correct dimensions',
      'Store logo/banner assets accessible',
      'No 404 on public storage URLs in smoke test',
    ],
    rollback: ['Revert CDN to previous origin if bad restore detected'],
  },
  {
    id: 'restore-configuration-git',
    domain: 'configuration',
    title: 'Configuration Restore from Git',
    estimatedMinutes: 15,
    prerequisites: ['Git access to release tag or commit SHA'],
    steps: [
      'Identify last known-good deployment tag (git tag -l)',
      'Checkout supabase/migrations at that tag if schema rollback needed',
      'Restore supabase/config.toml and edge function sources from tag',
      'Verify .env.example keys match deployed environment key set',
    ],
    verification: ['npm run typecheck', 'npm run audit:enterprise-backup passes'],
    rollback: ['Forward to latest main after hotfix branch'],
  },
  {
    id: 'restore-secrets-vault',
    domain: 'secrets',
    title: 'Secrets Restore from Vault Export',
    estimatedMinutes: 30,
    prerequisites: ['Encrypted vault backup from monthly export', 'Ops access to Supabase secrets + CI'],
    steps: [
      'Decrypt vault export in secure ops environment',
      'Rotate compromised secrets first if breach scenario',
      'supabase secrets set KEY=value for each required secret',
      'Update CI secret store (GitHub Actions secrets)',
      'Redeploy edge functions to pick up new secrets',
    ],
    verification: [
      'Edge function smoke test (get-store-products)',
      'Auth login flow succeeds',
      'No secret values in application logs',
    ],
    rollback: ['Re-apply previous vault version if new secrets invalid'],
  },
  {
    id: 'restore-environment',
    domain: 'environment',
    title: 'Environment Variables Restore',
    estimatedMinutes: 20,
    prerequisites: ['Deployment manifest or CI artifact with env key inventory'],
    steps: [
      'Compare deployed VITE_* and server env against .env.example inventory',
      'Restore missing keys from CI artifact or vault',
      'Set VITE_FAILOVER_SUPABASE_URL if DR failover required',
      'Rebuild and redeploy frontend with restored env',
    ],
    verification: ['resolveSupabaseConfig() points to correct endpoint', 'health.json accessible'],
    rollback: ['Revert deployment to previous release'],
  },
  {
    id: 'restore-background-queues',
    domain: 'background_queues',
    title: 'Background Queue Restore & Replay',
    estimatedMinutes: 45,
    prerequisites: ['Database restored with import_jobs table', 'Worker edge functions deployed'],
    steps: [
      'Call get_background_jobs_status() to assess pending/failed counts',
      'Identify poison messages in dead letter — quarantine if needed',
      'Reset stuck jobs: UPDATE import_jobs SET status=pending WHERE status=processing AND updated_at < now()-interval',
      'Deploy/restart process-import-jobs edge function',
      'Replay webhook_outbox failed events via retry_order_webhook_events if applicable',
    ],
    verification: [
      'Queue depth trending to zero',
      'No new dead letters for 15 minutes',
      'Sample import job completes successfully',
    ],
    rollback: ['Pause job enqueue; drain queue before re-restore DB'],
  },
  {
    id: 'restore-edge-functions',
    domain: 'edge_functions',
    title: 'Edge Functions Redeploy',
    estimatedMinutes: 30,
    prerequisites: ['Supabase CLI linked', 'ALLOWED_ORIGINS secret set'],
    steps: [
      'supabase secrets set ALLOWED_ORIGINS=<production URLs>',
      'supabase functions deploy get-store-products process-import-jobs optimize-image payment-webhook',
      'Verify edge observability headers propagate trace IDs',
      'Test storefront bundle edge path',
    ],
    verification: [
      'edge_invocations_total success in metrics',
      'Storefront products load via edge',
      'Payment webhook responds 200 on test payload',
    ],
    rollback: ['Redeploy previous function bundle from git tag'],
  },
  {
    id: 'restore-application-deploy',
    domain: 'application',
    title: 'Application Deployment Restore',
    estimatedMinutes: 20,
    prerequisites: ['Previous release artifact or git tag', 'CDN/hosting access'],
    steps: [
      'Identify last stable release tag',
      'Redeploy frontend from tag via CI or hosting rollback',
      'Clear CDN cache for index.html and critical assets',
      'Verify initMonitoring() and DR modules load without error',
    ],
    verification: [
      'Merchant login succeeds',
      'Checkout flow completes on staging store',
      'npm run recovery:check passes',
    ],
    rollback: ['Forward-fix on main if rollback insufficient'],
  },
];

export function getRestoreProcedure(domain: RestoreProcedure['domain']): RestoreProcedure[] {
  return RESTORE_PROCEDURES.filter((p) => p.domain === domain);
}

export function getRestoreProcedureById(id: string): RestoreProcedure | undefined {
  return RESTORE_PROCEDURES.find((p) => p.id === id);
}

export function listRestoreProcedures(): Pick<RestoreProcedure, 'id' | 'domain' | 'title'>[] {
  return RESTORE_PROCEDURES.map(({ id, domain, title }) => ({ id, domain, title }));
}
