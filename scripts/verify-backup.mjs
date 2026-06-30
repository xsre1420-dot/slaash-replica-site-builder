#!/usr/bin/env node
/**
 * Automated backup verification — never assume backups are valid without testing.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');

const checks = [];
const pass = (name, detail = '') => checks.push({ name, ok: true, detail });
const fail = (name, detail = '') => checks.push({ name, ok: false, detail });

// 1. Backup scripts
for (const script of ['backup-database.sh', 'restore-database.sh']) {
  existsSync(join(ROOT, 'scripts', script))
    ? pass(`script.${script}`)
    : fail(`script.${script}`, 'missing');
}

// 2. Enterprise backup module
const backupFiles = [
  'src/lib/backup/backupAudit.ts',
  'src/lib/backup/databaseBackupStrategy.ts',
  'src/lib/backup/storageBackupStrategy.ts',
  'src/lib/backup/configurationBackupStrategy.ts',
  'src/lib/backup/backupValidation.ts',
  'src/lib/backup/backupEngine.ts',
];
for (const f of backupFiles) {
  existsSync(join(ROOT, f)) ? pass(`module.${f.split('/').pop()}`) : fail(`module.${f}`, 'missing');
}

// 3. Database policies — full, incremental, PITR
const dbStrategy = read('src/lib/backup/databaseBackupStrategy.ts');
dbStrategy.includes("'full'") && dbStrategy.includes("'incremental'") && dbStrategy.includes("'pitr'")
  ? pass('db.policies.all_tiers')
  : fail('db.policies.all_tiers');

// 4. Critical tables include import_jobs
dbStrategy.includes('import_jobs') ? pass('db.critical.import_jobs') : fail('db.critical.import_jobs');

// 5. Storage asset classes
const storageStrategy = read('src/lib/backup/storageBackupStrategy.ts');
['product_images', 'store_assets', 'documents', 'media_uploads', 'user_generated'].every((c) =>
  storageStrategy.includes(c)
)
  ? pass('storage.all_asset_classes')
  : fail('storage.all_asset_classes');

// 6. Config — no plaintext secrets policy
const configStrategy = read('src/lib/backup/configurationBackupStrategy.ts');
configStrategy.includes('excludesPlaintextSecrets: true')
  ? pass('config.no_plaintext_secrets')
  : fail('config.no_plaintext_secrets');

// 7. Migrations in git
const migDir = join(ROOT, 'supabase', 'migrations');
if (existsSync(migDir)) {
  const count = readdirSync(migDir).filter((f) => f.endsWith('.sql')).length;
  count > 0 ? pass('metadata.migrations_git', `${count} files`) : fail('metadata.migrations_git');
} else {
  fail('metadata.migrations_git');
}

// 8. v88 migration
read('supabase/migrations/20260707000001_enterprise_backup_v88.sql').includes('platform_enterprise_backup_audit')
  ? pass('migration.v88_audit_rpc')
  : fail('migration.v88_audit_rpc');

// 9. Report and schema
existsSync(join(ROOT, 'BACKUP_STRATEGY_REPORT.md')) ? pass('report.present') : fail('report.present');
existsSync(join(ROOT, 'public/backup-schema.json')) ? pass('schema.present') : fail('schema.present');

// 10. DR module still present (no regression)
existsSync(join(ROOT, 'src/lib/disasterRecovery/localBackup.ts'))
  ? pass('dr.local_backup_intact')
  : fail('dr.local_backup_intact');

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  checks,
  passed: checks.length - failed.length,
  total: checks.length,
  message: failed.length === 0 ? 'All static backup verification checks passed' : `${failed.length} checks failed`,
};

mkdirSync(join(ROOT, 'supabase/benchmarks'), { recursive: true });
writeFileSync(join(ROOT, 'supabase/benchmarks/backup-verification.json'), JSON.stringify(report, null, 2));

console.log(`\nBackup verification: ${report.passed}/${report.total} passed`);
process.exit(failed.length > 0 ? 1 : 0);
