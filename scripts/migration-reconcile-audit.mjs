#!/usr/bin/env node
/**
 * Audit local migration files, deferred/blocked layout, remote history, and schema probes.
 *
 * Usage:
 *   node scripts/migration-reconcile-audit.mjs [--json] [--strict]
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import {
  loadManifest,
  listSqlFiles,
  listBlockedFiles,
  versionFromFile,
  findActiveDeferredViolations,
  findMissingDeferredFiles,
  blockedVersions,
  historyRepairEntries,
  MIGRATIONS_DIR,
  DEFERRED_DIR,
  BLOCKED_DIR,
} from './lib/migrationManifest.mjs';

const args = new Set(process.argv.slice(2));
const jsonOut = args.has('--json');
const strict = args.has('--strict');

function cliQuery(sql) {
  const result = spawnSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'supabase db query failed');
  }
  return JSON.parse(result.stdout);
}

function parseMigrationList() {
  const result = spawnSync('supabase', ['migration', 'list', '--linked'], {
    encoding: 'utf8',
    cwd: process.cwd(),
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'supabase migration list failed');
  }

  const rows = [];
  for (const line of (result.stdout || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(\d{14})\s*\|\s*(\d{14})?\s*\|/);
    if (!m) continue;
    rows.push({ local: m[1], remote: m[2] || null });
  }
  return rows;
}

async function probeSchema(probe) {
  if (probe.type === 'rpc') {
    const out = cliQuery(`
      SELECT 1 AS ok FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = '${probe.name}'
      LIMIT 1;
    `);
    return (out.rows ?? []).length > 0;
  }
  if (probe.type === 'table') {
    const out = cliQuery(`
      SELECT 1 AS ok FROM pg_tables
      WHERE schemaname = 'public' AND tablename = '${probe.name}'
      LIMIT 1;
    `);
    return (out.rows ?? []).length > 0;
  }
  return false;
}

async function main() {
  const manifest = loadManifest();
  const blocked = blockedVersions(manifest);
  const issues = [];
  const warnings = [];

  const activeViolations = findActiveDeferredViolations(manifest);
  if (activeViolations.length) {
    issues.push({
      code: 'DEFERRED_IN_ACTIVE',
      message: 'Deferred migrations must live in supabase/migrations/_deferred/',
      files: activeViolations,
    });
  }

  const missingDeferred = findMissingDeferredFiles(manifest);
  if (missingDeferred.length) {
    issues.push({
      code: 'DEFERRED_FILE_MISSING',
      message: 'Manifest deferred entries missing from _deferred/ and active folder',
      files: missingDeferred,
    });
  }

  for (const version of blocked) {
    const blockedGlob = listBlockedFiles(BLOCKED_DIR).some((f) => f.startsWith(`${version}_`));
    const activeGlob = listSqlFiles(MIGRATIONS_DIR).some((f) => f.startsWith(`${version}_`));
    const deferredGlob = listSqlFiles(DEFERRED_DIR).some((f) => f.startsWith(`${version}_`));
    if (!blockedGlob) {
      issues.push({
        code: 'BLOCKED_MISSING',
        message: `Blocked migration ${version} must exist under _blocked/`,
      });
    }
    if (activeGlob || deferredGlob) {
      issues.push({
        code: 'BLOCKED_EXPOSED',
        message: `Blocked migration ${version} must not appear in active or _deferred/`,
      });
    }
  }

  let migrationRows = [];
  try {
    migrationRows = parseMigrationList();
  } catch (err) {
    warnings.push({ code: 'REMOTE_LIST_FAILED', message: String(err.message || err) });
  }

  const localOnly = migrationRows.filter((r) => r.local && !r.remote).map((r) => r.local);
  const remoteOnly = migrationRows.filter((r) => r.remote && !r.local).map((r) => r.remote);

  const deferredVersions = new Set((manifest.deferred ?? []).map((d) => d.version));
  const unexpectedLocalOnly = localOnly.filter((v) => deferredVersions.has(v));

  if (unexpectedLocalOnly.length) {
    issues.push({
      code: 'DEFERRED_VISIBLE_TO_CLI',
      message: 'Deferred manifest versions still visible to supabase migration list — move files to _deferred/',
      versions: unexpectedLocalOnly,
    });
  }

  const allowedLocalOnly = localOnly.filter((v) => !deferredVersions.has(v));

  for (const repair of historyRepairEntries(manifest)) {
    const row = migrationRows.find((r) => r.local === repair.version);
    if (row?.remote) continue;

    let probesOk = true;
    for (const probe of repair.schemaProbes ?? []) {
      try {
        if (!(await probeSchema(probe))) probesOk = false;
      } catch {
        probesOk = false;
        warnings.push({
          code: 'PROBE_FAILED',
          message: `Could not verify probe for ${repair.version}`,
        });
      }
    }

    if (probesOk && (repair.schemaProbes ?? []).length > 0) {
      warnings.push({
        code: 'HISTORY_REPAIR_NEEDED',
        message: `${repair.version} schema present but missing from remote history — run db:migration:repair-history`,
      });
    } else if (!probesOk) {
      warnings.push({
        code: 'HISTORY_REPAIR_PENDING_SQL',
        message: `${repair.version} listed for history repair but schema probes not satisfied`,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    activeMigrationCount: listSqlFiles(MIGRATIONS_DIR).length,
    deferredMigrationCount: listSqlFiles(DEFERRED_DIR).length,
    blockedMigrationCount: listBlockedFiles(BLOCKED_DIR).length,
    localOnly,
    allowedLocalOnly,
    remoteOnly,
    unexpectedLocalOnly,
    issues,
    warnings,
    manifestHead: migrationRows.filter((r) => r.local && r.remote).slice(-5),
  };

  const outPath = join(process.cwd(), 'supabase/benchmarks/migration-reconcile-audit.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Migration reconciliation audit\n');
    console.log(`Active: ${report.activeMigrationCount}  Deferred: ${report.deferredMigrationCount}  Blocked: ${report.blockedMigrationCount}`);
    console.log(`Local-only (remote pending): ${localOnly.join(', ') || '(none)'}`);
    console.log(`Remote-only: ${remoteOnly.join(', ') || '(none)'}`);
    if (issues.length) {
      console.log('\nISSUES:');
      for (const i of issues) console.log(`  [${i.code}] ${i.message}`, i.files || i.versions || '');
    }
    if (warnings.length) {
      console.log('\nWARNINGS:');
      for (const w of warnings) console.log(`  [${w.code}] ${w.message}`);
    }
    console.log(`\nReport: ${outPath}`);
  }

  const fail = strict && issues.length > 0;
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
