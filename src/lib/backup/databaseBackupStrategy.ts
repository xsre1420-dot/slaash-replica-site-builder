/**
 * Phase 2 — Database backup strategy (full, incremental, PITR, retention, verification).
 */
export type BackupTier = 'full' | 'incremental' | 'pitr';

export type DatabaseBackupPolicy = {
  id: string;
  tier: BackupTier;
  schedule: string;
  retentionDays: number;
  rpoMinutes: number;
  rtoMinutes: number;
  verificationRequired: boolean;
  description: string;
};

export const DATABASE_BACKUP_POLICIES: DatabaseBackupPolicy[] = [
  {
    id: 'db-full-daily',
    tier: 'full',
    schedule: '0 2 * * *',
    retentionDays: 30,
    rpoMinutes: 1440,
    rtoMinutes: 60,
    verificationRequired: true,
    description: 'Daily full logical dump via supabase db dump (scripts/backup-database.sh)',
  },
  {
    id: 'db-full-weekly',
    tier: 'full',
    schedule: '0 3 * * 0',
    retentionDays: 90,
    rpoMinutes: 10080,
    rtoMinutes: 120,
    verificationRequired: true,
    description: 'Weekly full backup retained 90 days for compliance',
  },
  {
    id: 'db-incremental-wal',
    tier: 'incremental',
    schedule: 'continuous',
    retentionDays: 7,
    rpoMinutes: 15,
    rtoMinutes: 45,
    verificationRequired: true,
    description: 'WAL/archive via Supabase managed backups (Pro plan)',
  },
  {
    id: 'db-pitr',
    tier: 'pitr',
    schedule: 'continuous',
    retentionDays: 7,
    rpoMinutes: 1,
    rtoMinutes: 30,
    verificationRequired: true,
    description: 'Point-in-Time Recovery — enable in Supabase Project Settings → Database',
  },
];

export type DatabaseRecoveryObjective = {
  scenario: string;
  rpoMinutes: number;
  rtoMinutes: number;
  procedure: string;
};

export const DATABASE_RECOVERY_OBJECTIVES: DatabaseRecoveryObjective[] = [
  {
    scenario: 'Accidental row delete',
    rpoMinutes: 1,
    rtoMinutes: 30,
    procedure: 'Restore to PITR timestamp before delete; verify tenant isolation',
  },
  {
    scenario: 'Schema migration rollback',
    rpoMinutes: 15,
    rtoMinutes: 60,
    procedure: 'Restore from pre-migration full dump; replay migrations forward selectively',
  },
  {
    scenario: 'Complete region outage',
    rpoMinutes: 60,
    rtoMinutes: 120,
    procedure: 'Failover to secondary project from weekly full + WAL; update DNS/env',
  },
  {
    scenario: 'Corruption detected',
    rpoMinutes: 1,
    rtoMinutes: 45,
    procedure: 'PITR to last known-good; run platform_health_check + npm run backup:verify',
  },
];

export function getDatabaseBackupManifest(): {
  policies: DatabaseBackupPolicy[];
  recoveryObjectives: DatabaseRecoveryObjective[];
  scripts: string[];
  tablesCritical: string[];
} {
  return {
    policies: DATABASE_BACKUP_POLICIES,
    recoveryObjectives: DATABASE_RECOVERY_OBJECTIVES,
    scripts: ['scripts/backup-database.sh', 'scripts/restore-database.sh'],
    tablesCritical: [
      'orders',
      'order_items',
      'products',
      'stores',
      'profiles',
      'import_jobs',
      'payment_transactions',
      'platform_schema_version',
      'webhook_outbox',
    ],
  };
}
