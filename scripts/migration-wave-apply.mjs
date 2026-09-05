#!/usr/bin/env node
/**
 * Apply a manifest-defined deployment wave by temporarily staging non-wave migrations in _deferred/.
 *
 * Usage:
 *   node scripts/migration-wave-apply.mjs --wave=phase-3.4-dashboard --dry-run
 *   node scripts/migration-wave-apply.mjs --wave=phase-3.4-dashboard --apply
 *   node scripts/migration-wave-apply.mjs --manifest=custom-wave.txt --apply
 */
import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import {
  loadManifest,
  listSqlFiles,
  MIGRATIONS_DIR,
  DEFERRED_DIR,
  deferredFileMap,
  waveManifestPath,
} from './lib/migrationManifest.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const dryRun = args['dry-run'] === 'true' || args.dryRun === 'true';
const apply = args.apply === 'true';
const wave = args.wave;
const manifestFile = args.manifest;

const manifest = loadManifest();
const deferredMap = deferredFileMap(manifest);

let allowFiles = [];
if (manifestFile) {
  allowFiles = readFileSync(join(process.cwd(), manifestFile), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
} else if (wave) {
  const entry = [...deferredMap.values()].find((d) => d.wave === wave);
  if (!entry) {
    console.error(`Unknown wave "${wave}". Known waves: ${[...new Set([...deferredMap.values()].map((d) => d.wave))].join(', ')}`);
    process.exit(1);
  }
  for (const dep of entry.deployAfter ?? []) {
    const depEntry = [...deferredMap.values()].find((d) => d.version === dep);
    if (depEntry) {
      console.error(`REFUSED: deploy prerequisite ${dep} (${depEntry.wave}) not yet applied — still deferred.`);
      process.exit(1);
    }
  }
  if (entry.requiresApproval && !args['i-approve']) {
    console.error(`REFUSED: wave "${wave}" requires --i-approve flag.`);
    process.exit(1);
  }
  allowFiles = [entry.file];
} else {
  console.error('Provide --wave=<name> or --manifest=<file>');
  process.exit(1);
}

const activeDeferredCopies = listSqlFiles(MIGRATIONS_DIR).filter((f) => deferredMap.has(f.slice(0, 14)));
if (activeDeferredCopies.length) {
  console.error('REFUSED: deferred migrations must not be in active folder. Run reconciliation first.');
  process.exit(1);
}

mkdirSync(DEFERRED_DIR, { recursive: true });
const stagingDir = join(MIGRATIONS_DIR, '_wave_staging');
mkdirSync(stagingDir, { recursive: true });

const stagedToActive = [];
const stagedToDeferred = [];

for (const file of allowFiles) {
  const from = join(DEFERRED_DIR, file);
  const to = join(MIGRATIONS_DIR, file);
  if (!existsSync(from)) {
    console.error(`Wave file not in _deferred/: ${file}`);
    process.exit(1);
  }
  renameSync(from, to);
  stagedToActive.push(file);
}

for (const file of listSqlFiles(DEFERRED_DIR)) {
  if (allowFiles.includes(file)) continue;
}

console.log('═══════════════════════════════════════════════════');
console.log('  Migration Wave Apply');
console.log('═══════════════════════════════════════════════════');
console.log(`Wave: ${wave || manifestFile}`);
console.log(`Applying (${allowFiles.length}): ${allowFiles.join(', ')}\n`);

const pushArgs = ['db', 'push', ...(dryRun ? ['--dry-run'] : [])];
const result = spawnSync('supabase', pushArgs, { encoding: 'utf8', cwd: process.cwd(), shell: true });
console.log(result.stdout || '');
if (result.stderr) console.error(result.stderr);

const succeeded = result.status === 0;

if (!dryRun && apply && succeeded) {
  for (const file of stagedToActive) {
    const entry = deferredMap.get(file.slice(0, 14));
    if (entry) {
      writeFileSync(
        join(process.cwd(), 'supabase/benchmarks', `migration-wave-${entry.wave}-applied.json`),
        JSON.stringify({ appliedAt: new Date().toISOString(), wave: entry.wave, file, version: entry.version }, null, 2),
        'utf8'
      );
    }
  }
  console.log('\nApplied migrations remain in supabase/migrations/. Update migration-manifest.json deferred list.');
} else {
  for (const file of stagedToActive) {
    const from = join(MIGRATIONS_DIR, file);
    const to = join(DEFERRED_DIR, file);
    if (existsSync(from)) {
      renameSync(from, to);
      stagedToDeferred.push(file);
    }
  }
  console.log(`\nRestored ${stagedToDeferred.length} file(s) to _deferred/ (${dryRun ? 'dry-run' : 'push failed'})`);
}

process.exit(result.status ?? 1);
