export {
  OWASP_AUDIT_REGISTRY,
  getOwaspAuditSummary,
  type OwaspFinding,
  type OwaspAuditSummary,
} from './owaspAudit';

export {
  PENETRATION_SCENARIOS,
  getPenetrationReviewSummary,
  type PentestScenario,
  type PenetrationReviewSummary,
} from './penetrationReview';

export {
  DEPENDENCY_POLICY_REGISTRY,
  getDependencyAuditSummary,
  setDependencyAuditSnapshot,
  resetDependencyAuditForTests,
  type DependencyPolicy,
  type DependencyAuditSnapshot,
} from './dependencyAudit';

export {
  ABUSE_PROTECTION_REGISTRY,
  WAF_ABUSE_HEADERS,
  getAbuseProtectionSummary,
  getWafIntegrationManifest,
  registerReplayNonce,
  isReplayNonce,
  resetReplayGuardForTests,
  type AbuseControl,
  type WafIntegrationManifest,
} from './abuseProtection';

export {
  getSecurityCertificationStatus,
  initSecurityCertification,
  resetSecurityCertificationForTests,
  type SecurityCertificationStatus,
} from './certificationEngine';
