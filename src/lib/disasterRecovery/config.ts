/** Recovery objectives (documented targets for operations). */
export const DR_TARGETS = {
  /** Recovery Point Objective — max acceptable data loss */
  RPO_MINUTES: 60,
  /** Recovery Time Objective — max acceptable downtime */
  RTO_MINUTES: 30,
} as const;

export const DR_STORAGE_KEYS = {
  FAILOVER_ACTIVE: 'dr:failover-active',
  LAST_HEALTH_CHECK: 'dr:last-health-check',
  CONSECUTIVE_FAILURES: 'dr:consecutive-failures',
  LOCAL_BACKUP_VERSION: 'dr:local-backup-v1',
} as const;

export const DR_THRESHOLDS = {
  HEALTH_CHECK_INTERVAL_MS: 60_000,
  FAILURES_BEFORE_FAILOVER: 3,
  HEALTH_TIMEOUT_MS: 8_000,
} as const;

export type RecoveryMode = 'normal' | 'degraded' | 'failover';
