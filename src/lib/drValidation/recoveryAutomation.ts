/**
 * Phase 4 — Recovery automation registry and checklists.
 */
export type AutomationScript = {
  id: string;
  script: string;
  npmCommand: string;
  description: string;
  covers: string[];
};

export const RECOVERY_AUTOMATION_SCRIPTS: AutomationScript[] = [
  {
    id: 'recovery-check',
    script: 'scripts/recovery-check.mjs',
    npmCommand: 'recovery:check',
    description: 'Pre/post DR validation checklist (migrations, scripts, health)',
    covers: ['database', 'configuration', 'application'],
  },
  {
    id: 'verify-restore',
    script: 'scripts/verify-restore.mjs',
    npmCommand: 'restore:verify',
    description: 'Post-restore static verification of DR modules and playbooks',
    covers: ['database', 'storage', 'configuration', 'edge_functions'],
  },
  {
    id: 'verify-backup',
    script: 'scripts/verify-backup.mjs',
    npmCommand: 'backup:verify',
    description: 'Backup manifest and policy verification',
    covers: ['database', 'storage', 'configuration'],
  },
  {
    id: 'run-recovery-simulation',
    script: 'scripts/run-recovery-simulation.mjs',
    npmCommand: 'recovery:simulate',
    description: 'Automated recovery simulation checklist runner',
    covers: [
      'database_restore',
      'application_redeploy',
      'configuration_recovery',
      'environment_recovery',
      'background_worker_restart',
      'cache_rebuild',
    ],
  },
  {
    id: 'integrity-check',
    script: 'scripts/integrity-check.mjs',
    npmCommand: 'recovery:integrity-check',
    description: 'Post-recovery integrity validation suite',
    covers: [
      'data_integrity',
      'referential_integrity',
      'business_rules',
      'authentication',
      'permissions',
      'inventory_consistency',
      'order_consistency',
    ],
  },
  {
    id: 'chaos-audit',
    script: 'scripts/chaos-audit-test.mjs',
    npmCommand: 'db:chaos-test',
    description: 'Chaos engineering architecture validation',
    covers: ['order_consistency', 'business_rules', 'failover'],
  },
  {
    id: 'dr-validation-audit',
    script: 'scripts/dr-validation-audit.mjs',
    npmCommand: 'audit:dr-validation',
    description: 'Enterprise DR validation static audit (v90)',
    covers: ['all'],
  },
];

export type RecoveryChecklist = {
  id: string;
  phase: 'pre_recovery' | 'during_recovery' | 'post_recovery';
  items: string[];
};

export const RECOVERY_CHECKLISTS: RecoveryChecklist[] = [
  {
    id: 'pre-recovery',
    phase: 'pre_recovery',
    items: [
      'Declare incident and assign DR commander',
      'Identify recovery point (PITR timestamp or backup file)',
      'Notify stakeholders of estimated RTO',
      'Snapshot current broken state if forensically useful',
      'Confirm staging/recovery environment isolated from production traffic',
    ],
  },
  {
    id: 'during-recovery',
    phase: 'during_recovery',
    items: [
      'Follow SERVICE_RECOVERY_SEQUENCE order',
      'Execute linked restore procedure from RESTORE_PROCEDURES',
      'Log each step with timestamp for RTO measurement',
      'Do not resume customer traffic until post-validation passes',
    ],
  },
  {
    id: 'post-recovery',
    phase: 'post_recovery',
    items: [
      'Run npm run recovery:integrity-check',
      'Run npm run restore:verify',
      'Run platform_health_check() — expect ok',
      'Manual checkout smoke test on staging then production',
      'Manual storefront load test',
      'Record recovery duration and update operational readiness metrics',
      'Post-incident review within 48 hours',
    ],
  },
];

export function getAutomationCoverage(): {
  scripts: AutomationScript[];
  automatedSimulationCount: number;
  totalSimulationCount: number;
  checklistPhases: RecoveryChecklist['phase'][];
} {
  return {
    scripts: RECOVERY_AUTOMATION_SCRIPTS,
    automatedSimulationCount: 6,
    totalSimulationCount: 8,
    checklistPhases: RECOVERY_CHECKLISTS.map((c) => c.phase),
  };
}
