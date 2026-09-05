#!/usr/bin/env node
/**
 * Guarded supabase db push — refuses --include-all and ensures deferred/blocked
 * migrations are not in the active folder before pushing.
 *
 * Usage:
 *   node scripts/safe-db-push.mjs [--dry-run] [--force-unsafe]
 */
import { spawnSync } from 'child_process';
import {
  loadManifest,
  findActiveDeferredViolations,
  blockedVersions,
  listSqlFiles,
  MIGRATIONS_DIR,
} from './lib/migrationManifest.mjs';

const rawArgs = process.argv.slice(2);
if (rawArgs.includes('--include-all')) {
  console.error('REFUSED: supabase db push --include-all is permanently disabled.');
  console.error('Use: npm run db:migration:wave -- --wave=<name> --apply');
  process.exit(1);
}

const dryRun = rawArgs.includes('--dry-run');
const forceUnsafe = rawArgs.includes('--force-unsafe');

const manifest = loadManifest();
const violations = findActiveDeferredViolations(manifest);
if (violations.length) {
  console.error('REFUSED: deferred migrations found in active folder:');
  for (const f of violations) console.error(`  - ${f}`);
  console.error('Move them to supabase/migrations/_deferred/ before pushing.');
  process.exit(1);
}

for (const version of blockedVersions(manifest)) {
  const exposed = listSqlFiles(MIGRATIONS_DIR).some((f) => f.startsWith(`${version}_`));
  if (exposed) {
    console.error(`REFUSED: blocked migration ${version} is exposed in active folder.`);
    process.exit(1);
  }
}

if (!forceUnsafe) {
  const audit = spawnSync('node', ['scripts/migration-reconcile-audit.mjs', '--strict'], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (audit.stdout) process.stdout.write(audit.stdout);
  if (audit.stderr) process.stderr.write(audit.stderr);
  if (audit.status !== 0) {
    console.error('\nREFUSED: migration reconciliation audit failed. Fix drift before push.');
    process.exit(audit.status ?? 1);
  }
}

const pushArgs = ['db', 'push', ...(dryRun ? ['--dry-run'] : [])];
console.log(`Running: supabase ${pushArgs.join(' ')}\n`);
const result = spawnSync('supabase', pushArgs, { encoding: 'utf8', cwd: process.cwd(), shell: true });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
