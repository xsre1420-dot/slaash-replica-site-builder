import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSecurityAuditSummary,
  getVulnerabilityFixSummary,
  runStaticSecretsAudit,
  getSecureDefaultsManifest,
  getEnterpriseSecurityStatus,
  resetSecurityHardeningForTests,
  generateCsrfToken,
  storeCsrfToken,
  validateCsrfToken,
  isSafeRedirectUrl,
  validateUploadFile,
  stripUnknownKeys,
  resetCsrfForTests,
  VULNERABILITY_FIXES,
} from '@/lib/securityHardening';

describe('enterprise security hardening', () => {
  beforeEach(() => {
    resetSecurityHardeningForTests();
    resetCsrfForTests();
  });

  it('security audit has no open critical findings', () => {
    const audit = getSecurityAuditSummary();
    expect(audit.open).toBe(0);
    expect(audit.criticalFixed).toBeGreaterThanOrEqual(2);
    expect(audit.scoreAfterPct).toBeGreaterThanOrEqual(95);
  });

  it('all OWASP vulnerability categories addressed', () => {
    const summary = getVulnerabilityFixSummary();
    expect(summary.fixed).toBe(summary.total);
    expect(summary.criticalFixed).toBeGreaterThanOrEqual(2);
    expect(summary.categories.length).toBeGreaterThanOrEqual(10);
  });

  it('static secrets audit passes', () => {
    const results = runStaticSecretsAudit();
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('secure defaults define CSP and headers', () => {
    const defaults = getSecureDefaultsManifest();
    expect(defaults.csp).toContain("default-src 'self'");
    expect(defaults.headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(defaults.session.flowType).toBe('pkce');
  });

  it('CSRF token validation works', () => {
    const token = generateCsrfToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    storeCsrfToken(token);
    expect(validateCsrfToken(token)).toBe(true);
    expect(validateCsrfToken('wrong')).toBe(false);
  });

  it('safe redirect rejects external and protocol-relative URLs', () => {
    expect(isSafeRedirectUrl('/dashboard')).toBe(true);
    expect(isSafeRedirectUrl('//evil.com')).toBe(false);
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeRedirectUrl('https://evil.com')).toBe(false);
  });

  it('upload validation rejects dangerous files', () => {
    expect(validateUploadFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 }).valid).toBe(true);
    expect(validateUploadFile({ name: 'a.exe', type: 'application/octet-stream', size: 1000 }).valid).toBe(
      false
    );
    expect(validateUploadFile({ name: 'big.jpg', type: 'image/jpeg', size: 20 * 1024 * 1024 }).valid).toBe(
      false
    );
  });

  it('mass assignment guard strips unknown keys', () => {
    const result = stripUnknownKeys({ id: '1', name: 'x', admin: true }, ['id', 'name']);
    expect(result).toEqual({ id: '1', name: 'x' });
    expect('admin' in result).toBe(false);
  });

  it('enterprise security scores target 95+', () => {
    const status = getEnterpriseSecurityStatus();
    expect(status.scores.applicationSecurity).toBeGreaterThanOrEqual(95);
    expect(status.scores.authentication).toBeGreaterThanOrEqual(95);
    expect(status.scores.authorization).toBeGreaterThanOrEqual(95);
    expect(status.scores.secretManagement).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionSecurity).toBeGreaterThanOrEqual(95);
  });

  it('vulnerability registry covers required categories', () => {
    const cats = new Set(VULNERABILITY_FIXES.map((v) => v.category));
    expect(cats.has('sql_injection')).toBe(true);
    expect(cats.has('xss')).toBe(true);
    expect(cats.has('csrf')).toBe(true);
    expect(cats.has('open_cors')).toBe(true);
    expect(cats.has('unsafe_file_upload')).toBe(true);
  });
});
