/**
 * Backup schedule and retention policy matrix.
 */
export type RetentionTier = 'hot' | 'warm' | 'cold' | 'archive';

export type BackupScheduleEntry = {
  id: string;
  domain: 'database' | 'storage' | 'configuration' | 'metadata' | 'background_jobs';
  cron: string;
  retentionTier: RetentionTier;
  retentionDays: number;
  responsibleSystem: string;
};

export const BACKUP_SCHEDULE: BackupScheduleEntry[] = [
  {
    id: 'schedule-db-full-daily',
    domain: 'database',
    cron: '0 2 * * *',
    retentionTier: 'hot',
    retentionDays: 30,
    responsibleSystem: 'Supabase managed + scripts/backup-database.sh',
  },
  {
    id: 'schedule-db-full-weekly',
    domain: 'database',
    cron: '0 3 * * 0',
    retentionTier: 'warm',
    retentionDays: 90,
    responsibleSystem: 'Ops object storage (S3/GCS) offsite copy',
  },
  {
    id: 'schedule-db-pitr',
    domain: 'database',
    cron: 'continuous',
    retentionTier: 'hot',
    retentionDays: 7,
    responsibleSystem: 'Supabase PITR (Pro plan)',
  },
  {
    id: 'schedule-storage-daily',
    domain: 'storage',
    cron: '0 4 * * *',
    retentionTier: 'warm',
    retentionDays: 365,
    responsibleSystem: 'Bucket replication + versioning',
  },
  {
    id: 'schedule-config-on-deploy',
    domain: 'configuration',
    cron: 'on_deploy',
    retentionTier: 'hot',
    retentionDays: 90,
    responsibleSystem: 'CI artifact store + git tags',
  },
  {
    id: 'schedule-secrets-monthly',
    domain: 'configuration',
    cron: '0 1 1 * *',
    retentionTier: 'cold',
    retentionDays: 365,
    responsibleSystem: 'Vault encrypted export (ops manual)',
  },
  {
    id: 'schedule-metadata-git',
    domain: 'metadata',
    cron: 'continuous',
    retentionTier: 'archive',
    retentionDays: 9999,
    responsibleSystem: 'Git repository (migrations, schema version)',
  },
  {
    id: 'schedule-jobs-db',
    domain: 'background_jobs',
    cron: '0 2 * * *',
    retentionTier: 'hot',
    retentionDays: 30,
    responsibleSystem: 'Included in database full backup',
  },
];

export const RETENTION_POLICY = {
  hot: { minDays: 7, maxDays: 30, description: 'Fast restore — daily backups, PITR window' },
  warm: { minDays: 30, maxDays: 90, description: 'Weekly/monthly copies for compliance' },
  cold: { minDays: 90, maxDays: 365, description: 'Encrypted offsite, quarterly restore drills' },
  archive: { minDays: 365, maxDays: 2555, description: 'Legal/compliance long-term (documents tier)' },
} as const;

export function getBackupScheduleSummary(): {
  entries: BackupScheduleEntry[];
  retention: typeof RETENTION_POLICY;
} {
  return { entries: BACKUP_SCHEDULE, retention: RETENTION_POLICY };
}
