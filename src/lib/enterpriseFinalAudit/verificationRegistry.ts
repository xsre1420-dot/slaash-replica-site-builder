/**
 * Verification registry — final certification checks (v96).
 */
export type VerificationCheck = {
  id: string;
  category: string;
  check: string;
  command?: string;
  status: 'pass' | 'monitor' | 'manual';
};

export const VERIFICATION_REGISTRY: VerificationCheck[] = [
  { id: 'V-001', category: 'build', check: 'TypeScript typecheck', command: 'npm run typecheck', status: 'pass' },
  { id: 'V-002', category: 'test', check: 'Unit test suite', command: 'npm run test', status: 'pass' },
  { id: 'V-003', category: 'test', check: 'E2E playwright', command: 'npm run test:e2e', status: 'manual' },
  { id: 'V-004', category: 'security', check: 'Security hardening audit', command: 'npm run audit:security-hardening', status: 'pass' },
  { id: 'V-005', category: 'security', check: 'Supabase security audit', command: 'npm run audit:supabase-security', status: 'pass' },
  { id: 'V-006', category: 'security', check: 'Security certification audit', command: 'npm run audit:security-certification', status: 'pass' },
  { id: 'V-007', category: 'security', check: 'Secrets scan', command: 'npm run security:scan-secrets', status: 'pass' },
  { id: 'V-008', category: 'security', check: 'Dependency security audit', command: 'npm run audit:dependency-security', status: 'pass' },
  { id: 'V-009', category: 'infra', check: 'Infrastructure cost audit', command: 'npm run audit:infrastructure-cost', status: 'pass' },
  { id: 'V-010', category: 'infra', check: 'FinOps scaling audit', command: 'npm run audit:finops-scaling', status: 'pass' },
  { id: 'V-011', category: 'dr', check: 'Disaster recovery audit', command: 'npm run audit:disaster-recovery', status: 'pass' },
  { id: 'V-012', category: 'dr', check: 'DR validation audit', command: 'npm run audit:dr-validation', status: 'pass' },
  { id: 'V-013', category: 'monitoring', check: 'Observability foundation', command: 'npm run audit:observability-foundation', status: 'pass' },
  { id: 'V-014', category: 'monitoring', check: 'Enterprise alerting audit', command: 'npm run audit:enterprise-alerting', status: 'pass' },
  { id: 'V-015', category: 'scaling', check: 'Distributed scaling audit', command: 'npm run audit:distributed-scaling', status: 'pass' },
  { id: 'V-016', category: 'scaling', check: 'Read replica audit', command: 'npm run audit:read-replica', status: 'pass' },
  { id: 'V-017', category: 'scaling', check: 'Cache architecture audit', command: 'npm run audit:cache-architecture', status: 'pass' },
  { id: 'V-018', category: 'database', check: 'Tenant isolation test', command: 'npm run db:isolation-test', status: 'manual' },
  { id: 'V-019', category: 'database', check: 'Platform health check RPC', command: 'npm run db:check', status: 'manual' },
  { id: 'V-020', category: 'certification', check: 'Enterprise final audit', command: 'npm run audit:enterprise-final', status: 'pass' },
];

export function getVerificationSummary(): {
  checks: number;
  automated: number;
  manual: number;
} {
  return {
    checks: VERIFICATION_REGISTRY.length,
    automated: VERIFICATION_REGISTRY.filter((c) => c.status === 'pass').length,
    manual: VERIFICATION_REGISTRY.filter((c) => c.status === 'manual').length,
  };
}
