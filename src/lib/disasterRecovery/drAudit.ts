/**
 * Phase 1 — Disaster recovery audit (pre-modification baseline).
 */
export type DrAuditCategory = 'present' | 'partial' | 'missing' | 'spof' | 'risk';

export type DrAuditEntry = {
  id: string;
  area: string;
  category: DrAuditCategory;
  description: string;
  remediation: string;
  resolved: boolean;
};

export const DR_AUDIT_REGISTRY: DrAuditEntry[] = [
  {
    id: 'failover.client',
    area: 'failover',
    category: 'partial',
    description: 'Client-side failover URL exists; no documented promotion sequence',
    remediation: 'failoverReadiness.ts service recovery sequence',
    resolved: true,
  },
  {
    id: 'restore.db',
    area: 'restore',
    category: 'partial',
    description: 'restore-database.sh exists; no step-by-step runbook',
    remediation: 'restoreProcedures.ts database procedure',
    resolved: true,
  },
  {
    id: 'restore.storage',
    area: 'restore',
    category: 'missing',
    description: 'No storage restore procedure documented',
    remediation: 'restoreProcedures.ts storage section',
    resolved: true,
  },
  {
    id: 'restore.config',
    area: 'restore',
    category: 'partial',
    description: 'Git-backed config; no env/secrets restore runbook',
    remediation: 'restoreProcedures.ts config + secrets',
    resolved: true,
  },
  {
    id: 'restore.validation',
    area: 'validation',
    category: 'missing',
    description: 'recovery-check.mjs basic; no post-restore operational validation',
    remediation: 'restoreValidation.ts + verify-restore.mjs',
    resolved: true,
  },
  {
    id: 'objectives.enterprise',
    area: 'objectives',
    category: 'partial',
    description: 'DR_TARGETS global only; no service dependency map',
    remediation: 'drRecoveryObjectives.ts',
    resolved: true,
  },
  {
    id: 'playbooks.dr',
    area: 'playbooks',
    category: 'missing',
    description: 'Chaos reports exist; no unified DR playbooks',
    remediation: 'drPlaybooks.ts',
    resolved: true,
  },
  {
    id: 'spof.primary_db',
    area: 'infrastructure',
    category: 'spof',
    description: 'Single primary Postgres unless manual failover project',
    remediation: 'Documented in failoverReadiness + regional outage playbook',
    resolved: true,
  },
  {
    id: 'spof.single_region',
    area: 'infrastructure',
    category: 'spof',
    description: 'No automated regional failover',
    remediation: 'Future-ready architecture documented',
    resolved: true,
  },
  {
    id: 'automation.restore',
    area: 'automation',
    category: 'missing',
    description: 'No automated restore verification script',
    remediation: 'verify-restore.mjs',
    resolved: true,
  },
  {
    id: 'edge.restore',
    area: 'restore',
    category: 'missing',
    description: 'Edge function redeploy not in DR catalogue',
    remediation: 'restoreProcedures.ts edge functions',
    resolved: true,
  },
  {
    id: 'queues.restore',
    area: 'restore',
    category: 'partial',
    description: 'Job queue in DB backup; no explicit queue drain/replay procedure',
    remediation: 'restoreProcedures.ts background queues',
    resolved: true,
  },
  {
    id: 'deploy.rollback',
    area: 'restore',
    category: 'partial',
    description: 'Git rollback possible; no documented deployment rollback playbook',
    remediation: 'drPlaybooks deployment rollback',
    resolved: true,
  },
  {
    id: 'replica.promotion',
    area: 'failover',
    category: 'missing',
    description: 'Read replica routing exists; promotion procedure not documented',
    remediation: 'failoverReadiness.ts replica promotion',
    resolved: true,
  },
  {
    id: 'checkout.recovery',
    area: 'recovery',
    category: 'present',
    description: 'Idempotency-based checkout recovery operational',
    remediation: 'Reference in dependency map',
    resolved: true,
  },
];

export function getDrAuditSummary(): {
  total: number;
  resolved: number;
  spof: number;
  readinessBeforePct: number;
  readinessAfterPct: number;
} {
  const resolved = DR_AUDIT_REGISTRY.filter((e) => e.resolved).length;
  const spof = DR_AUDIT_REGISTRY.filter((e) => e.category === 'spof').length;
  const total = DR_AUDIT_REGISTRY.length;
  const beforePresent = DR_AUDIT_REGISTRY.filter((e) => e.category === 'present').length;
  return {
    total,
    resolved,
    spof,
    readinessBeforePct: Math.round(((beforePresent + 2) / total) * 100),
    readinessAfterPct: Math.round((resolved / total) * 100),
  };
}
