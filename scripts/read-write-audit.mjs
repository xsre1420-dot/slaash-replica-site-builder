#!/usr/bin/env node
/**
 * Classifies service modules into READ / WRITE / MIXED for CQRS audit reports.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SERVICES = join(ROOT, 'src', 'services');

const WRITE_PATTERNS = [
  /\.insert\(/,
  /\.update\(/,
  /\.delete\(/,
  /\.upsert\(/,
  /invalidate/,
  /flushOrderCache/,
  /syncProductCachesAfterMutation/,
  /bumpStorefrontCacheVersion/,
  /createOrder/,
  /restockProduct/,
];

const READ_PATTERNS = [
  /\.select\(/,
  /\.rpc\('get_/,
  /\.rpc\('list_/,
  /\.rpc\('fetch_/,
  /callReadRpc/,
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue;
      walk(p, acc);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

function classifyFile(path) {
  const rel = relative(join(ROOT, 'src'), path).replace(/\\/g, '/');
  const text = readFileSync(path, 'utf8');
  if (rel.includes('/read/')) return { rel, kind: 'READ' };
  if (rel.includes('/write/')) return { kind: 'WRITE', rel };
  const READ_PRIMARY_MIXED = [
    'services/storefrontProductService.ts',
    'services/merchantProductCatalogService.ts',
    'services/marketingService.ts',
    'services/suggestedProductsService.ts',
    'services/footerSuggestedProductsService.ts',
    'services/reviewService.ts',
    'services/storefrontReviewService.ts',
    'services/platformHealthService.ts',
  ];
  if (READ_PRIMARY_MIXED.includes(rel)) return { rel, kind: 'READ_PRIMARY' };
  if (rel.endsWith('Service.ts') || rel.includes('CrudService')) {
    if (/Legacy .* facade|facade/i.test(text)) return { rel, kind: 'FACADE' };
    const hasWrite = WRITE_PATTERNS.some((r) => r.test(text));
    const hasRead = READ_PATTERNS.some((r) => r.test(text));
    if (hasWrite && hasRead) return { rel, kind: 'MIXED' };
    if (hasWrite) return { rel, kind: 'WRITE' };
    if (hasRead) return { rel, kind: 'READ' };
  }
  return { rel, kind: 'OTHER' };
}

const files = walk(SERVICES);
const rows = files.map(classifyFile).sort((a, b) => a.rel.localeCompare(b.rel));

const summary = rows.reduce(
  (m, r) => {
    m[r.kind] = (m[r.kind] ?? 0) + 1;
    return m;
  },
  /** @type {Record<string, number>} */ ({})
);

console.log(JSON.stringify({ summary, rows: rows.filter((r) => r.kind !== 'OTHER') }, null, 2));

const mixed = rows.filter((r) => r.kind === 'MIXED');
if (mixed.length > 0) {
  console.error(`\nMIXED services remain: ${mixed.map((m) => m.rel).join(', ')}`);
  process.exit(1);
}
