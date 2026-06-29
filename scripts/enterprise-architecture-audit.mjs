#!/usr/bin/env node
/**
 * Enterprise architecture audit — repository layer, module boundaries, direct Supabase usage.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

const LAYERS = {
  repositories: join(SRC, 'repositories'),
  modules: join(SRC, 'modules'),
  core: join(SRC, 'core'),
  config: join(SRC, 'config'),
  background: join(SRC, 'background'),
  servicesRead: join(SRC, 'services', 'read'),
  servicesWrite: join(SRC, 'services', 'write'),
  services: join(SRC, 'services'),
};

function walk(dir, acc = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

function countTsFiles(dir) {
  return walk(dir).length;
}

function filesWithDirectSupabase(dir) {
  return walk(dir).filter((p) => {
    const text = readFileSync(p, 'utf8');
    return (
      text.includes("@/integrations/supabase/client") ||
      text.includes("from '@/integrations/supabase/client'")
    );
  });
}

const repoFiles = walk(LAYERS.repositories);
const moduleFiles = walk(LAYERS.modules);
const readServices = walk(LAYERS.servicesRead);
const writeServices = walk(LAYERS.servicesWrite);
const allServices = walk(LAYERS.services);

const readDirectSupabase = readServices.filter((p) =>
  readFileSync(p, 'utf8').includes("@/integrations/supabase/client")
);
const writeDirectSupabase = writeServices.filter((p) =>
  readFileSync(p, 'utf8').includes("@/integrations/supabase/client")
);

const legacyServiceDirect = allServices
  .filter((p) => !p.includes(`${join('services', 'read')}`) && !p.includes(`${join('services', 'write')}`))
  .filter((p) => readFileSync(p, 'utf8').includes("@/integrations/supabase/client"));

const allowedDirect = new Set([
  relative(ROOT, join(SRC, 'repositories', 'base', 'index.ts')).replace(/\\/g, '/'),
  relative(ROOT, join(SRC, 'integrations', 'supabase', 'rpc.ts')).replace(/\\/g, '/'),
]);

const allDirect = filesWithDirectSupabase(SRC).map((p) => relative(ROOT, p).replace(/\\/g, '/'));
const violations = allDirect.filter((p) => !allowedDirect.has(p) && !p.startsWith('src/repositories/'));

const report = {
  generatedAt: new Date().toISOString(),
  layers: {
    repositories: countTsFiles(LAYERS.repositories),
    modules: countTsFiles(LAYERS.modules),
    core: countTsFiles(LAYERS.core),
    config: countTsFiles(LAYERS.config),
    background: countTsFiles(LAYERS.background),
    servicesRead: readServices.length,
    servicesWrite: writeServices.length,
    servicesTotal: allServices.length,
  },
  repositoryDomains: repoFiles
    .map((p) => relative(LAYERS.repositories, p).replace(/\\/g, '/'))
    .filter((p) => p.endsWith('Repository.ts') || p === 'index.ts'),
  moduleDomains: moduleFiles
    .map((p) => relative(LAYERS.modules, p).replace(/\\/g, '/'))
    .filter((p) => p.endsWith('index.ts')),
  directSupabase: {
    readServices: readDirectSupabase.map((p) => relative(ROOT, p).replace(/\\/g, '/')),
    writeServices: writeDirectSupabase.map((p) => relative(ROOT, p).replace(/\\/g, '/')),
    legacyServices: legacyServiceDirect.map((p) => relative(ROOT, p).replace(/\\/g, '/')),
    otherViolations: violations.filter(
      (p) =>
        !p.includes('services/read/') &&
        !p.includes('services/write/') &&
        !p.startsWith('src/services/')
    ),
  },
  scores: {},
};

const readClean = readDirectSupabase.length === 0;
const writeClean = writeDirectSupabase.length === 0;
const repoScore = Math.min(100, 85 + repoFiles.length * 2);
const moduleScore = Math.min(100, 80 + moduleFiles.length * 1.5);
const layerScore =
  readClean && writeClean ? 98 : readClean || writeClean ? 92 : 85;

report.scores = {
  repositoryLayer: repoScore,
  moduleBoundaries: Math.round(moduleScore),
  readWriteIsolation: layerScore,
  directSupabaseCompliance: Math.max(
    70,
    100 - violations.length * 2
  ),
};

console.log(JSON.stringify(report, null, 2));

const fail =
  readDirectSupabase.length > 0 ||
  writeDirectSupabase.length > 0;

process.exit(fail ? 1 : 0);
