import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
export const MANIFEST_PATH = join(ROOT, 'supabase/migration-manifest.json');
export const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
export const DEFERRED_DIR = join(MIGRATIONS_DIR, '_deferred');
export const BLOCKED_DIR = join(MIGRATIONS_DIR, '_blocked');

export function loadManifest(path = MANIFEST_PATH) {
  if (!existsSync(path)) {
    throw new Error(`Migration manifest not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function listSqlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export function listBlockedFiles(dir = BLOCKED_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.sql.blocked') || f.includes('.sql.'))
    .sort();
}

export function versionFromFile(file) {
  const match = /^(\d{14})_/.exec(file);
  return match ? match[1] : null;
}

export function deferredFileMap(manifest) {
  const map = new Map();
  for (const entry of manifest.deferred ?? []) {
    map.set(entry.version, entry);
  }
  return map;
}

export function blockedVersions(manifest) {
  return new Set(manifest.blockedVersions ?? []);
}

export function historyRepairEntries(manifest) {
  return manifest.historyRepair ?? [];
}

export function findActiveDeferredViolations(manifest) {
  const deferredFiles = new Set((manifest.deferred ?? []).map((d) => d.file));
  const active = listSqlFiles(MIGRATIONS_DIR);
  return active.filter((f) => deferredFiles.has(f));
}

export function findMissingDeferredFiles(manifest) {
  const missing = [];
  for (const entry of manifest.deferred ?? []) {
    const inDeferred = existsSync(join(DEFERRED_DIR, entry.file));
    const inActive = existsSync(join(MIGRATIONS_DIR, entry.file));
    if (!inDeferred && !inActive) {
      missing.push(entry.file);
    }
  }
  return missing;
}

export function waveManifestPath(wave) {
  return join(ROOT, `supabase/deploy-waves/${wave}.txt`);
}
