import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecoveryValidationAuditSummary,
  listRecoverySimulations,
  RECOVERY_SIMULATIONS,
  runStaticIntegrityValidation,
  getIntegrityValidationSummary,
  getAutomationCoverage,
  RECOVERY_CHECKLISTS,
  getDrValidationStatus,
  resetDrValidationForTests,
  resetIntegrityValidationForTests,
  resetOperationalReadinessForTests,
  INTEGRITY_CHECKS,
} from '@/lib/drValidation';

describe('enterprise DR validation', () => {
  beforeEach(() => {
    resetDrValidationForTests();
    resetIntegrityValidationForTests();
    resetOperationalReadinessForTests();
  });

  it('validation audit resolves all gaps', () => {
    const audit = getRecoveryValidationAuditSummary();
    expect(audit.resolved).toBe(audit.total);
    expect(audit.validationAfterPct).toBeGreaterThanOrEqual(95);
  });

  it('covers all required recovery simulation scenarios', () => {
    const sims = listRecoverySimulations();
    const ids = new Set(sims.map((s) => s.id));
    expect(ids.has('database_restore')).toBe(true);
    expect(ids.has('storage_restore')).toBe(true);
    expect(ids.has('application_redeploy')).toBe(true);
    expect(ids.has('configuration_recovery')).toBe(true);
    expect(ids.has('environment_recovery')).toBe(true);
    expect(ids.has('background_worker_restart')).toBe(true);
    expect(ids.has('queue_recovery')).toBe(true);
    expect(ids.has('cache_rebuild')).toBe(true);
    expect(RECOVERY_SIMULATIONS.length).toBe(8);
  });

  it('integrity checks cover all required domains', () => {
    const domains = new Set(INTEGRITY_CHECKS.map((c) => c.domain));
    expect(domains.has('data_integrity')).toBe(true);
    expect(domains.has('referential_integrity')).toBe(true);
    expect(domains.has('business_rules')).toBe(true);
    expect(domains.has('authentication')).toBe(true);
    expect(domains.has('permissions')).toBe(true);
    expect(domains.has('inventory_consistency')).toBe(true);
    expect(domains.has('order_consistency')).toBe(true);
    expect(domains.has('financial_consistency')).toBe(true);
  });

  it('static integrity validation passes', () => {
    const results = runStaticIntegrityValidation();
    expect(results.every((r) => r.status === 'passed')).toBe(true);
    const summary = getIntegrityValidationSummary();
    expect(summary.failed).toBe(0);
    expect(summary.domains.length).toBe(8);
  });

  it('automation coverage includes simulation and integrity scripts', () => {
    const coverage = getAutomationCoverage();
    expect(coverage.scripts.some((s) => s.npmCommand === 'recovery:simulate')).toBe(true);
    expect(coverage.scripts.some((s) => s.npmCommand === 'recovery:integrity-check')).toBe(true);
    expect(coverage.automatedSimulationCount).toBeGreaterThanOrEqual(6);
  });

  it('recovery checklists cover pre/during/post phases', () => {
    const phases = new Set(RECOVERY_CHECKLISTS.map((c) => c.phase));
    expect(phases.has('pre_recovery')).toBe(true);
    expect(phases.has('during_recovery')).toBe(true);
    expect(phases.has('post_recovery')).toBe(true);
  });

  it('DR validation status scores target 95+', () => {
    const status = getDrValidationStatus();
    expect(status.scores.recoveryValidation).toBeGreaterThanOrEqual(95);
    expect(status.scores.operationalReadiness).toBeGreaterThanOrEqual(95);
    expect(status.scores.businessContinuity).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionReadiness).toBeGreaterThanOrEqual(95);
  });

  it('operational readiness includes confidence and risks', () => {
    const status = getDrValidationStatus();
    expect(status.operationalReadiness.recoveryConfidence).toBeGreaterThanOrEqual(95);
    expect(status.operationalReadiness.remainingRisks.length).toBeGreaterThan(0);
  });

  it('simulations link to restore procedures', () => {
    RECOVERY_SIMULATIONS.forEach((s) => {
      expect(s.linkedProcedureId.length).toBeGreaterThan(0);
      expect(s.successCriteria.length).toBeGreaterThan(0);
    });
  });

  it('majority of simulations are automated', () => {
    const automated = RECOVERY_SIMULATIONS.filter((s) => s.automated).length;
    expect(automated / RECOVERY_SIMULATIONS.length).toBeGreaterThanOrEqual(0.75);
  });
});
