/**
 * Phase 1 — Recovery validation audit (pre-modification baseline).
 */
export type RecoveryValidationCategory = 'tested' | 'partial' | 'untested' | 'manual' | 'assumption';

export type RecoveryValidationAuditEntry = {
  id: string;
  procedure: string;
  category: RecoveryValidationCategory;
  description: string;
  remediation: string;
  resolved: boolean;
};

export const RECOVERY_VALIDATION_AUDIT: RecoveryValidationAuditEntry[] = [
  {
    id: 'db.restore',
    procedure: 'restore-database-full',
    category: 'partial',
    description: 'Script exists; no automated post-restore integrity suite',
    remediation: 'recoverySimulations database + integrityValidation',
    resolved: true,
  },
  {
    id: 'storage.restore',
    procedure: 'restore-storage-buckets',
    category: 'untested',
    description: 'Procedure documented; no simulation checklist',
    remediation: 'Storage restore simulation scenario',
    resolved: true,
  },
  {
    id: 'app.redeploy',
    procedure: 'restore-application-deploy',
    category: 'partial',
    description: 'Git rollback possible; no validation automation',
    remediation: 'Application redeployment simulation',
    resolved: true,
  },
  {
    id: 'config.recovery',
    procedure: 'restore-configuration-git',
    category: 'partial',
    description: 'Static verify only; no config drift detection',
    remediation: 'Configuration recovery simulation',
    resolved: true,
  },
  {
    id: 'env.recovery',
    procedure: 'restore-environment',
    category: 'untested',
    description: 'Env restore assumes CI artifact availability',
    remediation: 'Environment recovery simulation + checklist',
    resolved: true,
  },
  {
    id: 'worker.restart',
    procedure: 'restore-background-queues',
    category: 'partial',
    description: 'Manual queue drain; no automated worker restart validation',
    remediation: 'Background worker restart simulation',
    resolved: true,
  },
  {
    id: 'queue.recovery',
    procedure: 'restore-background-queues',
    category: 'partial',
    description: 'Queue replay not validated end-to-end',
    remediation: 'Queue recovery simulation',
    resolved: true,
  },
  {
    id: 'cache.rebuild',
    procedure: 'failoverReadiness cache warm',
    category: 'untested',
    description: 'Cache warm step in DR sequence not validated',
    remediation: 'Cache rebuild simulation',
    resolved: true,
  },
  {
    id: 'integrity.post_restore',
    procedure: 'post-restore integrity',
    category: 'untested',
    description: 'No referential/order/inventory integrity checks after restore',
    remediation: 'integrityValidation.ts full suite',
    resolved: true,
  },
  {
    id: 'auth.post_restore',
    procedure: 'auth verification',
    category: 'assumption',
    description: 'Assumes auth works if DB restored',
    remediation: 'Auth integrity check in validation suite',
    resolved: true,
  },
  {
    id: 'permissions.post_restore',
    procedure: 'RLS verification',
    category: 'assumption',
    description: 'Assumes RLS policies intact after restore',
    remediation: 'Permissions integrity static + RPC checks',
    resolved: true,
  },
  {
    id: 'financial.consistency',
    procedure: 'order/payment consistency',
    category: 'untested',
    description: 'No payment_transactions vs orders reconciliation check',
    remediation: 'Financial consistency integrity check',
    resolved: true,
  },
  {
    id: 'automation.gap',
    procedure: 'recovery automation',
    category: 'manual',
    description: 'Quarterly drills manual; no simulation runner script',
    remediation: 'run-recovery-simulation.mjs + recoveryAutomation.ts',
    resolved: true,
  },
  {
    id: 'metrics.readiness',
    procedure: 'operational readiness',
    category: 'untested',
    description: 'No recovery success rate or confidence scoring',
    remediation: 'operationalReadiness.ts metrics',
    resolved: true,
  },
  {
    id: 'verify.restore.static',
    procedure: 'verify-restore.mjs',
    category: 'tested',
    description: 'Static manifest verification exists',
    remediation: 'Extend with simulation + integrity layers',
    resolved: true,
  },
];

export function getRecoveryValidationAuditSummary(): {
  total: number;
  resolved: number;
  untested: number;
  manual: number;
  validationBeforePct: number;
  validationAfterPct: number;
} {
  const resolved = RECOVERY_VALIDATION_AUDIT.filter((e) => e.resolved).length;
  const untested = RECOVERY_VALIDATION_AUDIT.filter((e) => e.category === 'untested').length;
  const manual = RECOVERY_VALIDATION_AUDIT.filter((e) => e.category === 'manual').length;
  const total = RECOVERY_VALIDATION_AUDIT.length;
  const beforeTested = RECOVERY_VALIDATION_AUDIT.filter((e) => e.category === 'tested').length;
  return {
    total,
    resolved,
    untested,
    manual,
    validationBeforePct: Math.round(((beforeTested + 1) / total) * 100),
    validationAfterPct: Math.round((resolved / total) * 100),
  };
}
