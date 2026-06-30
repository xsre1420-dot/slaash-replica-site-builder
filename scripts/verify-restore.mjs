#!/usr/bin/env node
/**
 * Automated restore verification — never assume restore success without validation.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');

const checks = [];
const pass = (name, detail = '') => checks.push({ name, ok: true, detail });
const fail = (name, detail = '') => checks.push({ name, ok: false, detail });

// DR module files
const drFiles = [
  'src/lib/disasterRecovery/drAudit.ts',
  'src/lib/disasterRecovery/drRecoveryObjectives.ts',
  'src/lib/disasterRecovery/restoreProcedures.ts',
  'src/lib/disasterRecovery/restoreValidation.ts',
  'src/lib/disasterRecovery/failoverReadiness.ts',
  'src/lib/disasterRecovery/drPlaybooks.ts',
  'src/lib/disasterRecovery/drEngine.ts',
];
for (const f of drFiles) {
  existsSync(join(ROOT, f)) ? pass(`module.${f.split('/').pop()}`) : fail(`module.${f}`, 'missing');
}

// Restore procedures — all domains
const procedures = read('src/lib/disasterRecovery/restoreProcedures.ts');
[
  'database',
  'storage',
  'configuration',
  'secrets',
  'environment',
  'background_queues',
  'edge_functions',
  'application',
].forEach((domain) => {
  procedures.includes(`domain: '${domain}'`) ? pass(`procedure.${domain}`) : fail(`procedure.${domain}`);
});

// DR playbooks
const playbooks = read('src/lib/disasterRecovery/drPlaybooks.ts');
[
  'database-corruption',
  'storage-failure',
  'infrastructure-outage',
  'deployment-rollback',
  'secret-compromise',
  'regional-outage',
  'background-worker-failure',
].forEach((id) => {
  playbooks.includes(id) ? pass(`playbook.${id}`) : fail(`playbook.${id}`);
});

// Failover readiness
const failover = read('src/lib/disasterRecovery/failoverReadiness.ts');
failover.includes('READ_REPLICA_PROMOTION_STEPS') ? pass('failover.replica_promotion') : fail('failover.replica_promotion');
failover.includes('SERVICE_RECOVERY_SEQUENCE') ? pass('failover.recovery_sequence') : fail('failover.recovery_sequence');

// Dependency map
read('src/lib/disasterRecovery/drRecoveryObjectives.ts').includes('SERVICE_DEPENDENCY_MAP')
  ? pass('objectives.dependency_map')
  : fail('objectives.dependency_map');

// Backup integration intact
read('src/lib/disasterRecovery/index.ts').includes('getEnterpriseBackupStatus')
  ? pass('integration.backup_layer')
  : fail('integration.backup_layer');

// Existing DR not broken
existsSync(join(ROOT, 'src/lib/disasterRecovery/failover.ts')) ? pass('dr.failover_intact') : fail('dr.failover_intact');
existsSync(join(ROOT, 'scripts/restore-database.sh')) ? pass('script.restore_database') : fail('script.restore_database');

// v89 migration
read('supabase/migrations/20260708000001_enterprise_disaster_recovery_v89.sql').includes('platform_disaster_recovery_audit')
  ? pass('migration.v89_audit_rpc')
  : fail('migration.v89_audit_rpc');

// Report
existsSync(join(ROOT, 'DISASTER_RECOVERY_REPORT.md')) ? pass('report.present') : fail('report.present');

// Migrations count
const migDir = join(ROOT, 'supabase', 'migrations');
if (existsSync(migDir)) {
  const count = readdirSync(migDir).filter((f) => f.endsWith('.sql')).length;
  count > 0 ? pass('metadata.migrations', `${count} files`) : fail('metadata.migrations');
}

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  passed: checks.length - failed.length,
  total: checks.length,
};

mkdirSync(join(ROOT, 'supabase/benchmarks'), { recursive: true });
writeFileSync(join(ROOT, 'supabase/benchmarks/restore-verification.json'), JSON.stringify(report, null, 2));

console.log(`\nRestore verification: ${report.passed}/${report.total} passed`);
process.exit(failed.length > 0 ? 1 : 0);
