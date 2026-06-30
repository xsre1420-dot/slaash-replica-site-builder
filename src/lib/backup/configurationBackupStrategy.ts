/**
 * Phase 4 — Configuration & secrets backup strategy.
 */
export type ConfigBackupScope =
  | 'environment_variables'
  | 'secrets'
  | 'config_files'
  | 'infrastructure'
  | 'deployment';

export type ConfigurationBackupPolicy = {
  id: string;
  scope: ConfigBackupScope;
  source: string;
  schedule: string;
  retentionDays: number;
  encrypted: boolean;
  excludesPlaintextSecrets: boolean;
  description: string;
};

export const CONFIGURATION_BACKUP_POLICIES: ConfigurationBackupPolicy[] = [
  {
    id: 'config-env-snapshot',
    scope: 'environment_variables',
    source: '.env.example + deployment manifest (keys only)',
    schedule: 'on_deploy',
    retentionDays: 90,
    encrypted: true,
    excludesPlaintextSecrets: true,
    description: 'Non-secret env key inventory; values in vault/CI secrets only',
  },
  {
    id: 'config-secrets-vault',
    scope: 'secrets',
    source: 'Supabase secrets + CI secret store',
    schedule: '0 1 1 * *',
    retentionDays: 365,
    encrypted: true,
    excludesPlaintextSecrets: true,
    description: 'Encrypted vault export — never commit plaintext secrets to git',
  },
  {
    id: 'config-files-git',
    scope: 'config_files',
    source: 'git: supabase/config.toml, vite.config.ts, tsconfig*.json',
    schedule: 'continuous',
    retentionDays: 9999,
    encrypted: false,
    excludesPlaintextSecrets: true,
    description: 'Version-controlled config files — git is the backup',
  },
  {
    id: 'config-infra-migrations',
    scope: 'infrastructure',
    source: 'git: supabase/migrations/, supabase/functions/',
    schedule: 'continuous',
    retentionDays: 9999,
    encrypted: false,
    excludesPlaintextSecrets: true,
    description: 'SQL migrations and edge functions — immutable git history',
  },
  {
    id: 'config-deployment',
    scope: 'deployment',
    source: '.github/workflows/, vercel.json, Dockerfile (if any)',
    schedule: 'on_deploy',
    retentionDays: 365,
    encrypted: false,
    excludesPlaintextSecrets: true,
    description: 'CI/CD and deployment configuration snapshots tagged per release',
  },
];

/** Inventory of secret names (never values) for audit. */
export const SECRETS_INVENTORY = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'ALLOWED_ORIGINS',
  'REDIS_URL',
  'VITE_FAILOVER_SUPABASE_URL',
  'PAGERDUTY_ROUTING_KEY',
  'OBSERVABILITY_WEBHOOK_URL',
] as const;

export function getConfigurationBackupManifest(): {
  policies: ConfigurationBackupPolicy[];
  secretsInventory: readonly string[];
  gitBackedPaths: string[];
} {
  return {
    policies: CONFIGURATION_BACKUP_POLICIES,
    secretsInventory: SECRETS_INVENTORY,
    gitBackedPaths: [
      'supabase/migrations/',
      'supabase/config.toml',
      'supabase/functions/',
      '.github/workflows/',
      '.env.example',
      'public/backup-schema.json',
    ],
  };
}
