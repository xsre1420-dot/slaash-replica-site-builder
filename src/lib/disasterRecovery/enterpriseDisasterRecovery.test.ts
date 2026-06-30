import { describe, it, expect, beforeEach } from 'vitest';
import { getDrAuditSummary } from '@/lib/disasterRecovery/drAudit';
import { getEnterpriseRecoveryTargets } from '@/lib/disasterRecovery/drRecoveryObjectives';
import {
  listRestoreProcedures,
  getRestoreProcedureById,
  RESTORE_PROCEDURES,
} from '@/lib/disasterRecovery/restoreProcedures';
import {
  runStaticRestoreValidation,
  getRestoreValidationSummary,
  resetRestoreValidationForTests,
} from '@/lib/disasterRecovery/restoreValidation';
import {
  getFailoverReadinessSnapshot,
  SERVICE_RECOVERY_SEQUENCE,
} from '@/lib/disasterRecovery/failoverReadiness';
import { listDrPlaybooks, getDrPlaybook, DR_PLAYBOOKS } from '@/lib/disasterRecovery/drPlaybooks';
import {
  getEnterpriseDisasterRecoveryStatus,
  resetDisasterRecoveryForTests,
} from '@/lib/disasterRecovery/drEngine';

describe('enterprise disaster recovery', () => {
  beforeEach(() => {
    resetDisasterRecoveryForTests();
    resetRestoreValidationForTests();
  });

  it('DR audit resolves all gaps', () => {
    const audit = getDrAuditSummary();
    expect(audit.resolved).toBe(audit.total);
    expect(audit.readinessAfterPct).toBeGreaterThanOrEqual(95);
  });

  it('defines enterprise RTO/RPO and critical services', () => {
    const targets = getEnterpriseRecoveryTargets();
    expect(targets.globalRtoMinutes).toBeGreaterThan(0);
    expect(targets.globalRpoMinutes).toBeGreaterThan(0);
    expect(targets.criticalServices.length).toBeGreaterThanOrEqual(7);
    expect(targets.dependencyMap.length).toBeGreaterThanOrEqual(10);
    expect(targets.recoverySequence.length).toBeGreaterThan(10);
  });

  it('documents restore procedures for all required domains', () => {
    const procedures = listRestoreProcedures();
    const domains = new Set(procedures.map((p) => p.domain));
    expect(domains.has('database')).toBe(true);
    expect(domains.has('storage')).toBe(true);
    expect(domains.has('secrets')).toBe(true);
    expect(domains.has('edge_functions')).toBe(true);
    expect(domains.has('background_queues')).toBe(true);
    expect(domains.has('application')).toBe(true);
    expect(RESTORE_PROCEDURES.length).toBeGreaterThanOrEqual(8);
  });

  it('restore procedures include verification steps', () => {
    const db = getRestoreProcedureById('restore-database-full');
    expect(db?.verification.length).toBeGreaterThan(0);
    expect(db?.steps.length).toBeGreaterThan(3);
  });

  it('static restore validation passes', () => {
    const results = runStaticRestoreValidation();
    expect(results.every((r) => r.status === 'passed')).toBe(true);
    const summary = getRestoreValidationSummary();
    expect(summary.failed).toBe(0);
  });

  it('failover readiness documents recovery sequence', () => {
    const snapshot = getFailoverReadinessSnapshot();
    expect(snapshot.recoverySequence.length).toBeGreaterThanOrEqual(10);
    expect(snapshot.replicaPromotion.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.capabilities.some((c) => c.id === 'client-endpoint-failover')).toBe(true);
  });

  it('DR playbooks cover required scenarios', () => {
    const playbooks = listDrPlaybooks();
    expect(playbooks.length).toBeGreaterThanOrEqual(7);
    expect(getDrPlaybook('database-corruption')?.immediateActions.length).toBeGreaterThan(0);
    expect(getDrPlaybook('regional-outage')?.escalationPath.length).toBeGreaterThan(0);
    expect(DR_PLAYBOOKS.map((p) => p.id)).toContain('secret-compromise');
  });

  it('service recovery sequence is ordered', () => {
    expect(SERVICE_RECOVERY_SEQUENCE[0].service).toBe('secrets');
    expect(SERVICE_RECOVERY_SEQUENCE.some((s) => s.service === 'validation')).toBe(true);
  });

  it('enterprise DR status scores target 95+', () => {
    const status = getEnterpriseDisasterRecoveryStatus();
    expect(status.scores.recoveryReadiness).toBeGreaterThanOrEqual(95);
    expect(status.scores.restoreReliability).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionReadiness).toBeGreaterThanOrEqual(95);
  });

  it('integrates with backup strategy layer', () => {
    const status = getEnterpriseDisasterRecoveryStatus();
    expect(status.backupIntegration.scores.backupCoverage).toBeGreaterThanOrEqual(95);
  });
});
