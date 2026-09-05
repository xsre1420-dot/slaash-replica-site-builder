#!/usr/bin/env node
/**
 * Repair remote migration history for entries applied out-of-band (schema present, history missing).
 *
 * Usage:
 *   node scripts/migration-repair-history.mjs [--dry-run] [--version=20260905000001]
 */
import { spawnSync } from 'child_process';
import { historyRepairEntries, loadManifest } from './lib/migrationManifest.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const dryRun = args['dry-run'] === 'true' || args.dryRun === 'true';
const onlyVersion = args.version;

function cliQuery(sql) {
  const result = spawnSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

async function probesSatisfied(probes) {
  for (const probe of probes ?? []) {
    if (probe.type === 'rpc') {
      const out = cliQuery(`
        SELECT 1 AS ok FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = '${probe.name}' LIMIT 1;
      `);
      if (!(out.rows ?? []).length) return false;
    } else if (probe.type === 'table') {
      const out = cliQuery(`
        SELECT 1 AS ok FROM pg_tables
        WHERE schemaname = 'public' AND tablename = '${probe.name}' LIMIT 1;
      `);
      if (!(out.rows ?? []).length) return false;
    }
  }
  return (probes ?? []).length > 0;
}

function migrationListHasRemote(version) {
  const result = spawnSync('supabase', ['migration', 'list', '--linked'], {
    encoding: 'utf8',
    cwd: process.cwd(),
    shell: true,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  const re = new RegExp(`^\\s*${version}\\s*\\|\\s*${version}\\s*\\|`, 'm');
  return re.test(result.stdout || '');
}

async function main() {
  const manifest = loadManifest();
  const entries = historyRepairEntries(manifest).filter((e) => !onlyVersion || e.version === onlyVersion);

  if (!entries.length) {
    console.log('No history repair entries matched.');
    process.exit(0);
  }

  for (const entry of entries) {
    if (migrationListHasRemote(entry.version)) {
      console.log(`SKIP ${entry.version}: already in remote history`);
      continue;
    }

    const ok = await probesSatisfied(entry.schemaProbes);
    if (!ok) {
      console.error(`REFUSED ${entry.version}: schema probes not satisfied — apply SQL first or fix probes.`);
      process.exit(1);
    }

    const cmd = ['migration', 'repair', '--status', 'applied', entry.version];
    console.log(`${dryRun ? '[dry-run] ' : ''}supabase ${cmd.join(' ')} — ${entry.reason}`);
    if (!dryRun) {
      const result = spawnSync('supabase', cmd, { encoding: 'utf8', cwd: process.cwd(), shell: true });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }

  console.log('\nHistory repair complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
