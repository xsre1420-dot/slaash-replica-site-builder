import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRlsAuditSummary,
  getAuthSecuritySummary,
  getAuthorizationAuditSummary,
  getStorageSecuritySummary,
  getEdgeFunctionSecuritySummary,
  runSupabaseSecretsChecks,
  getSupabaseSecurityStatus,
  resetSupabaseSecurityForTests,
  RLS_TABLE_REGISTRY,
  EDGE_FUNCTION_REGISTRY,
  AUTHORIZATION_MATRIX,
} from '@/lib/supabaseSecurity';

describe('enterprise supabase security', () => {
  beforeEach(() => {
    resetSupabaseSecurityForTests();
  });

  it('RLS registry covers critical tenant tables', () => {
    const summary = getRlsAuditSummary();
    expect(summary.rlsEnabled).toBe(summary.tables);
    expect(summary.coveragePct).toBe(100);
    expect(RLS_TABLE_REGISTRY.some((t) => t.table === 'orders')).toBe(true);
    expect(RLS_TABLE_REGISTRY.some((t) => t.table === 'rpc_rate_limits')).toBe(true);
  });

  it('auth security controls meet target score', () => {
    const auth = getAuthSecuritySummary();
    expect(auth.score).toBeGreaterThanOrEqual(95);
    expect(auth.implemented).toBeGreaterThanOrEqual(10);
  });

  it('authorization matrix covers all roles', () => {
    const authz = getAuthorizationAuditSummary();
    expect(authz.verified).toBe(authz.roles);
    expect(AUTHORIZATION_MATRIX.some((r) => r.role === 'service_role')).toBe(true);
    expect(AUTHORIZATION_MATRIX.some((r) => r.role === 'anon')).toBe(true);
  });

  it('storage buckets are owner-scoped for writes', () => {
    const storage = getStorageSecuritySummary();
    expect(storage.score).toBeGreaterThanOrEqual(95);
    expect(storage.ownerScoped).toBe(storage.buckets);
  });

  it('edge functions registry covers all deployed functions', () => {
    expect(EDGE_FUNCTION_REGISTRY.length).toBeGreaterThanOrEqual(8);
    const edge = getEdgeFunctionSecuritySummary();
    expect(edge.score).toBeGreaterThanOrEqual(95);
    expect(EDGE_FUNCTION_REGISTRY.every((f) => f.inputValidation)).toBe(true);
  });

  it('supabase secrets checks pass', () => {
    const checks = runSupabaseSecretsChecks();
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it('supabase security status scores target 95+', () => {
    const status = getSupabaseSecurityStatus();
    expect(status.scores.rlsSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.authentication).toBeGreaterThanOrEqual(95);
    expect(status.scores.authorization).toBeGreaterThanOrEqual(95);
    expect(status.scores.storageSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.edgeFunctionSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.supabaseSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionReadiness).toBeGreaterThanOrEqual(95);
  });

  it('RLS findings have no open critical issues', () => {
    const status = getSupabaseSecurityStatus();
    const openCritical = status.rlsFindings.filter(
      (f) => f.severity === 'critical' && f.status === 'open'
    );
    expect(openCritical.length).toBe(0);
  });
});
