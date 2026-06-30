import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDomainAssessmentSummary,
  getVerificationSummary,
  getTechnicalDebtSummary,
  getEnterpriseFinalAuditStatus,
  resetEnterpriseFinalAuditForTests,
  DOMAIN_ASSESSMENTS,
  VERIFICATION_REGISTRY,
  PRODUCTION_LAUNCH_CHECKLIST,
  TECHNICAL_DEBT_REGISTRY,
} from '@/lib/enterpriseFinalAudit';

describe('enterprise final audit', () => {
  beforeEach(() => {
    resetEnterpriseFinalAuditForTests();
  });

  it('covers all required assessment domains', () => {
    const summary = getDomainAssessmentSummary();
    expect(summary.domains).toBeGreaterThanOrEqual(25);
    expect(summary.certified).toBeGreaterThanOrEqual(24);
    expect(summary.avgScore).toBeGreaterThanOrEqual(95);
    expect(DOMAIN_ASSESSMENTS.some((d) => d.domain === 'frontend')).toBe(true);
    expect(DOMAIN_ASSESSMENTS.some((d) => d.domain === 'edge_functions')).toBe(true);
    expect(DOMAIN_ASSESSMENTS.some((d) => d.domain === 'cost_efficiency')).toBe(true);
  });

  it('verification registry includes security and infra audits', () => {
    const v = getVerificationSummary();
    expect(v.checks).toBeGreaterThanOrEqual(18);
    expect(VERIFICATION_REGISTRY.some((c) => c.command?.includes('security-certification'))).toBe(true);
    expect(VERIFICATION_REGISTRY.some((c) => c.command?.includes('finops-scaling'))).toBe(true);
  });

  it('technical debt has zero production blockers', () => {
    const debt = getTechnicalDebtSummary();
    expect(debt.blocksProduction).toBe(0);
    expect(TECHNICAL_DEBT_REGISTRY.every((t) => !t.blocksProduction)).toBe(true);
  });

  it('production launch checklist is complete', () => {
    expect(PRODUCTION_LAUNCH_CHECKLIST.length).toBeGreaterThanOrEqual(10);
    expect(PRODUCTION_LAUNCH_CHECKLIST.some((c) => c.id === 'PL-08')).toBe(true);
  });

  it('all final scores target 95+', () => {
    const status = getEnterpriseFinalAuditStatus();
    expect(status.scores.architecture).toBeGreaterThanOrEqual(95);
    expect(status.scores.performance).toBeGreaterThanOrEqual(95);
    expect(status.scores.security).toBeGreaterThanOrEqual(95);
    expect(status.scores.scalability).toBeGreaterThanOrEqual(95);
    expect(status.scores.reliability).toBeGreaterThanOrEqual(95);
    expect(status.scores.maintainability).toBeGreaterThanOrEqual(95);
    expect(status.scores.developerExperience).toBeGreaterThanOrEqual(95);
    expect(status.scores.infrastructure).toBeGreaterThanOrEqual(95);
    expect(status.scores.operationalReadiness).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionReadiness).toBeGreaterThanOrEqual(95);
    expect(status.scores.overallEnterprise).toBeGreaterThanOrEqual(95);
  });

  it('platform is certification ready', () => {
    const status = getEnterpriseFinalAuditStatus();
    expect(status.certificationReady).toBe(true);
    expect(status.schemaVersion).toBe(96);
    expect(status.priorPhases.securityCertification.overallEnterpriseSecurity).toBeGreaterThanOrEqual(95);
  });

  it('prior phases integrated', () => {
    const status = getEnterpriseFinalAuditStatus();
    expect(status.priorPhases.finOpsScaling.productionReadiness).toBeGreaterThanOrEqual(95);
    expect(status.priorPhases.costOptimization.infrastructureEfficiency).toBeGreaterThanOrEqual(95);
    expect(status.issuesFixed.length).toBeGreaterThanOrEqual(5);
  });
});
