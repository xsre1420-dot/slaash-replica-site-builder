import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBackupAuditSummary,
  getDatabaseBackupManifest,
  getStorageBackupManifest,
  getConfigurationBackupManifest,
  runStaticBackupValidation,
  getValidationSummary,
  getBackupScheduleSummary,
  getPlatformRecoveryTargets,
  getEnterpriseBackupStatus,
  resetBackupForTests,
  resetValidationForTests,
  DATABASE_BACKUP_POLICIES,
  STORAGE_BACKUP_POLICIES,
  BACKUP_VALIDATION_PROCEDURES,
} from '@/lib/backup';

describe('enterprise backup strategy', () => {
  beforeEach(() => {
    resetBackupForTests();
    resetValidationForTests();
  });

  it('audit registry resolves all gaps', () => {
    const audit = getBackupAuditSummary();
    expect(audit.resolved).toBe(audit.total);
    expect(audit.coverageAfterPct).toBeGreaterThanOrEqual(95);
  });

  it('defines database full incremental and PITR policies', () => {
    const manifest = getDatabaseBackupManifest();
    expect(manifest.policies.length).toBeGreaterThanOrEqual(4);
    const tiers = new Set(manifest.policies.map((p) => p.tier));
    expect(tiers.has('full')).toBe(true);
    expect(tiers.has('incremental')).toBe(true);
    expect(tiers.has('pitr')).toBe(true);
    expect(manifest.tablesCritical).toContain('orders');
    expect(manifest.tablesCritical).toContain('import_jobs');
  });

  it('covers all storage asset classes', () => {
    const manifest = getStorageBackupManifest();
    expect(manifest.policies.length).toBe(5);
    const classes = new Set(manifest.policies.map((p) => p.assetClass));
    expect(classes.has('product_images')).toBe(true);
    expect(classes.has('user_generated')).toBe(true);
  });

  it('configuration backup excludes plaintext secrets', () => {
    const manifest = getConfigurationBackupManifest();
    expect(manifest.policies.every((p) => p.excludesPlaintextSecrets)).toBe(true);
    expect(manifest.secretsInventory.length).toBeGreaterThanOrEqual(8);
    expect(manifest.gitBackedPaths).toContain('supabase/migrations/');
  });

  it('validation procedures exist for each domain', () => {
    expect(BACKUP_VALIDATION_PROCEDURES.length).toBeGreaterThanOrEqual(5);
    const domains = new Set(BACKUP_VALIDATION_PROCEDURES.map((p) => p.domain));
    expect(domains.has('database')).toBe(true);
    expect(domains.has('storage')).toBe(true);
    expect(domains.has('configuration')).toBe(true);
  });

  it('static validation passes all checks', () => {
    const results = runStaticBackupValidation();
    expect(results.every((r) => r.status === 'passed')).toBe(true);
    const summary = getValidationSummary();
    expect(summary.failed).toBe(0);
  });

  it('backup schedule covers all domains', () => {
    const { entries } = getBackupScheduleSummary();
    const domains = new Set(entries.map((e) => e.domain));
    expect(domains.has('database')).toBe(true);
    expect(domains.has('storage')).toBe(true);
    expect(domains.has('background_jobs')).toBe(true);
  });

  it('recovery objectives define RPO/RTO per subsystem', () => {
    const targets = getPlatformRecoveryTargets();
    expect(targets.objectives.length).toBeGreaterThanOrEqual(8);
    expect(targets.globalRpoMinutes).toBeGreaterThan(0);
    const orders = targets.objectives.find((o) => o.subsystem === 'database_orders');
    expect(orders?.rpoMinutes).toBeLessThanOrEqual(15);
  });

  it('enterprise status scores target 95+', () => {
    const status = getEnterpriseBackupStatus();
    expect(status.scores.backupCoverage).toBeGreaterThanOrEqual(95);
    expect(status.scores.recoveryReadiness).toBeGreaterThanOrEqual(95);
    expect(status.scores.productionReadiness).toBeGreaterThanOrEqual(95);
    expect(status.coverage.every((c) => c.covered)).toBe(true);
  });

  it('database policies include verification requirement', () => {
    expect(DATABASE_BACKUP_POLICIES.every((p) => p.verificationRequired)).toBe(true);
  });

  it('storage policies enable versioning', () => {
    expect(STORAGE_BACKUP_POLICIES.every((p) => p.versioning)).toBe(true);
  });
});
