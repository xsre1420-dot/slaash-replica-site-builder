/**
 * Recovery objectives (RPO/RTO) per subsystem.
 */
import { DR_TARGETS } from '@/lib/disasterRecovery/config';

export type SubsystemRecoveryObjective = {
  subsystem: string;
  rpoMinutes: number;
  rtoMinutes: number;
  backupSource: string;
  priority: 1 | 2 | 3;
};

export const RECOVERY_OBJECTIVES: SubsystemRecoveryObjective[] = [
  {
    subsystem: 'database_orders',
    rpoMinutes: 1,
    rtoMinutes: 30,
    backupSource: 'PITR + daily full',
    priority: 1,
  },
  {
    subsystem: 'database_catalog',
    rpoMinutes: 15,
    rtoMinutes: 45,
    backupSource: 'PITR + daily full',
    priority: 1,
  },
  {
    subsystem: 'storage_product_images',
    rpoMinutes: 1440,
    rtoMinutes: 120,
    backupSource: 'Bucket replication daily',
    priority: 2,
  },
  {
    subsystem: 'storage_store_assets',
    rpoMinutes: 1440,
    rtoMinutes: 120,
    backupSource: 'Bucket replication daily',
    priority: 2,
  },
  {
    subsystem: 'configuration',
    rpoMinutes: 0,
    rtoMinutes: 15,
    backupSource: 'Git + CI artifacts',
    priority: 2,
  },
  {
    subsystem: 'secrets',
    rpoMinutes: 0,
    rtoMinutes: 30,
    backupSource: 'Vault encrypted export',
    priority: 1,
  },
  {
    subsystem: 'background_jobs',
    rpoMinutes: 15,
    rtoMinutes: 60,
    backupSource: 'DB backup (import_jobs table)',
    priority: 2,
  },
  {
    subsystem: 'platform_metadata',
    rpoMinutes: 0,
    rtoMinutes: 10,
    backupSource: 'Git migrations + platform_schema_version',
    priority: 1,
  },
  {
    subsystem: 'client_session',
    rpoMinutes: 0,
    rtoMinutes: 5,
    backupSource: 'localBackup.ts export',
    priority: 3,
  },
];

export function getPlatformRecoveryTargets(): {
  globalRpoMinutes: number;
  globalRtoMinutes: number;
  objectives: SubsystemRecoveryObjective[];
} {
  return {
    globalRpoMinutes: DR_TARGETS.RPO_MINUTES,
    globalRtoMinutes: DR_TARGETS.RTO_MINUTES,
    objectives: RECOVERY_OBJECTIVES,
  };
}
