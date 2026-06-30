import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOwaspAuditSummary,
  getPenetrationReviewSummary,
  getDependencyAuditSummary,
  getAbuseProtectionSummary,
  getWafIntegrationManifest,
  getSecurityCertificationStatus,
  resetSecurityCertificationForTests,
  resetDependencyAuditForTests,
  resetReplayGuardForTests,
  registerReplayNonce,
  isReplayNonce,
  OWASP_AUDIT_REGISTRY,
  PENETRATION_SCENARIOS,
  ABUSE_PROTECTION_REGISTRY,
  WAF_ABUSE_HEADERS,
} from '@/lib/securityCertification';

describe('enterprise security certification', () => {
  beforeEach(() => {
    resetSecurityCertificationForTests();
    resetDependencyAuditForTests();
    resetReplayGuardForTests();
  });

  it('OWASP audit has no open critical or high findings', () => {
    const owasp = getOwaspAuditSummary();
    expect(owasp.openCritical).toBe(0);
    expect(owasp.openHigh).toBe(0);
    expect(owasp.score).toBeGreaterThanOrEqual(95);
    expect(OWASP_AUDIT_REGISTRY.length).toBeGreaterThanOrEqual(20);
  });

  it('penetration review blocks all critical scenarios', () => {
    const pentest = getPenetrationReviewSummary();
    const criticalTotal = PENETRATION_SCENARIOS.filter((s) => s.severity === 'critical').length;
    expect(pentest.criticalBlocked).toBe(criticalTotal);
    expect(pentest.score).toBeGreaterThanOrEqual(95);
  });

  it('dependency audit meets target with no runtime critical/high', () => {
    const deps = getDependencyAuditSummary();
    expect(deps.npmAudit?.critical).toBe(0);
    expect(deps.npmAudit?.high).toBe(0);
    expect(deps.score).toBeGreaterThanOrEqual(95);
  });

  it('abuse protection controls are active or ready', () => {
    const abuse = getAbuseProtectionSummary();
    expect(abuse.active + abuse.ready).toBeGreaterThanOrEqual(6);
    expect(abuse.score).toBeGreaterThanOrEqual(95);
    expect(ABUSE_PROTECTION_REGISTRY.length).toBeGreaterThanOrEqual(8);
  });

  it('WAF integration is vendor-neutral', () => {
    const waf = getWafIntegrationManifest();
    expect(waf.providerAgnostic).toBe(true);
    expect(waf.recommendedRules.length).toBeGreaterThanOrEqual(4);
    expect(WAF_ABUSE_HEADERS.requestId).toBe('X-Request-Id');
  });

  it('replay nonce guard rejects duplicates', () => {
    const nonce = 'a'.repeat(32);
    expect(registerReplayNonce(nonce)).toBe(true);
    expect(registerReplayNonce(nonce)).toBe(false);
    expect(isReplayNonce(nonce)).toBe(true);
  });

  it('certification status scores all target 95+', () => {
    const status = getSecurityCertificationStatus();
    expect(status.scores.owaspCompliance).toBeGreaterThanOrEqual(95);
    expect(status.scores.applicationSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.infrastructureSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.dependencySecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.operationalSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.overallEnterpriseSecurity).toBeGreaterThanOrEqual(95);
  });

  it('platform is certification-ready', () => {
    const status = getSecurityCertificationStatus();
    expect(status.certificationReady).toBe(true);
    expect(status.schemaVersion).toBe(93);
    expect(status.issuesFixed.length).toBeGreaterThanOrEqual(5);
  });
});
