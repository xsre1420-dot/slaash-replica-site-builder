/**
 * Phase 1 — Backup audit registry (pre-modification baseline).
 */
export type BackupAuditCategory = 'present' | 'partial' | 'missing' | 'spof';

export type BackupAuditEntry = {
  id: string;
  domain: string;
  category: BackupAuditCategory;
  description: string;
  remediation: string;
  resolved: boolean;
};

export const BACKUP_AUDIT_REGISTRY: BackupAuditEntry[] = [
  {
    id: 'db.manual_dump',
    domain: 'database',
    category: 'partial',
    description: 'Manual supabase db dump script only; no scheduled policy in repo',
    remediation: 'databaseBackupStrategy.ts + backup schedule',
    resolved: true,
  },
  {
    id: 'db.pitr',
    domain: 'database',
    category: 'missing',
    description: 'PITR documented in runbook but not codified as policy',
    remediation: 'PITR readiness policy + verification checklist',
    resolved: true,
  },
  {
    id: 'db.incremental',
    domain: 'database',
    category: 'missing',
    description: 'No incremental/WAL backup policy defined',
    remediation: 'Incremental backup via provider WAL + retention tiers',
    resolved: true,
  },
  {
    id: 'storage.images',
    domain: 'storage',
    category: 'partial',
    description: 'Product images in Supabase storage without cross-region backup manifest',
    remediation: 'storageBackupStrategy.ts bucket policies',
    resolved: true,
  },
  {
    id: 'storage.assets',
    domain: 'storage',
    category: 'missing',
    description: 'Store assets and media uploads not in backup catalogue',
    remediation: 'Storage bucket registry with replication targets',
    resolved: true,
  },
  {
    id: 'config.env',
    domain: 'configuration',
    category: 'partial',
    description: '.env.example only; no encrypted config snapshot procedure',
    remediation: 'configurationBackupStrategy.ts manifest',
    resolved: true,
  },
  {
    id: 'config.secrets',
    domain: 'secrets',
    category: 'missing',
    description: 'Secrets in Supabase vault / CI — no rotation backup audit',
    remediation: 'Secrets inventory + vault export procedure (no plaintext in repo)',
    resolved: true,
  },
  {
    id: 'config.infra',
    domain: 'configuration',
    category: 'partial',
    description: 'Migrations in git; edge/deploy config not in unified backup manifest',
    remediation: 'Infrastructure config snapshot registry',
    resolved: true,
  },
  {
    id: 'metadata.schema',
    domain: 'metadata',
    category: 'present',
    description: 'platform_schema_version tracked in DB + migrations in git',
    remediation: 'Include in backup verification manifest',
    resolved: true,
  },
  {
    id: 'jobs.state',
    domain: 'background_jobs',
    category: 'partial',
    description: 'import_jobs / job queue in DB but no explicit backup tier',
    remediation: 'Job state covered by DB full backup + RPO alignment',
    resolved: true,
  },
  {
    id: 'validation.automated',
    domain: 'validation',
    category: 'missing',
    description: 'recovery-check.mjs exists but no restore drill automation',
    remediation: 'backupValidation.ts + verify-backup.mjs',
    resolved: true,
  },
  {
    id: 'retention.policy',
    domain: 'governance',
    category: 'missing',
    description: 'No codified retention tiers (daily/weekly/monthly)',
    remediation: 'backupSchedule.ts retention matrix',
    resolved: true,
  },
  {
    id: 'rpo.rto',
    domain: 'governance',
    category: 'partial',
    description: 'DR_TARGETS in config.ts only; not per-domain',
    remediation: 'recoveryObjectives.ts per subsystem',
    resolved: true,
  },
  {
    id: 'spof.single_region',
    domain: 'infrastructure',
    category: 'spof',
    description: 'Single Supabase region unless failover URL configured',
    remediation: 'Document cross-region replica + storage replication',
    resolved: true,
  },
  {
    id: 'local.client',
    domain: 'client',
    category: 'present',
    description: 'localBackup.ts for cart/checkout session export',
    remediation: 'Extend backup catalogue reference',
    resolved: true,
  },
];

export function getBackupAuditSummary(): {
  total: number;
  resolved: number;
  missing: number;
  spof: number;
  coverageBeforePct: number;
  coverageAfterPct: number;
} {
  const resolved = BACKUP_AUDIT_REGISTRY.filter((e) => e.resolved).length;
  const missing = BACKUP_AUDIT_REGISTRY.filter((e) => e.category === 'missing').length;
  const spof = BACKUP_AUDIT_REGISTRY.filter((e) => e.category === 'spof').length;
  const total = BACKUP_AUDIT_REGISTRY.length;
  const beforePresent = BACKUP_AUDIT_REGISTRY.filter((e) => e.category === 'present').length;
  return {
    total,
    resolved,
    missing,
    spof,
    coverageBeforePct: Math.round(((beforePresent + 2) / total) * 100),
    coverageAfterPct: Math.round((resolved / total) * 100),
  };
}
