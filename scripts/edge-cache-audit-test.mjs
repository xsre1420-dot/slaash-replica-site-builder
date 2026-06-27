#!/usr/bin/env node
/**
 * Edge cache architecture static validation.
 * Usage: node scripts/edge-cache-audit-test.mjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const tests = [];

const edgeFn = read('supabase/functions/get-store-products/index.ts');
const edgeShared = read('supabase/functions/_shared/edgeCache.ts');
const edgeService = read('src/services/storefrontEdgeService.ts');
const cacheService = read('src/services/storefrontCacheService.ts');
const migration = read('supabase/migrations/20260625000056_edge_cache_versioning.sql');

tests.push({
  name: 'edge function uses version-aware shared cache',
  pass: edgeFn.includes('edgeCache.ts') && edgeFn.includes('get_storefront_cache_version'),
});

tests.push({
  name: 'edge cache module supports purge by slug',
  pass: edgeShared.includes('purgeSlugFromMemory') && edgeShared.includes('buildPayloadKey'),
});

tests.push({
  name: 'edge responses set Cache-Control and ETag',
  pass: edgeFn.includes('ETag') && edgeShared.includes('edgeCacheControlHeader'),
});

tests.push({
  name: 'client edge service exposes meta + purge',
  pass: edgeService.includes('fetchStorefrontMetaViaEdge') && edgeService.includes('requestEdgeStorefrontPurge'),
});

tests.push({
  name: 'client cache keys are version-scoped',
  pass: cacheService.includes('storefront-version') && cacheService.includes('edge-meta'),
});

tests.push({
  name: 'migration adds storefront_cache_version + bump RPC',
  pass:
    migration.includes('storefront_cache_version') &&
    migration.includes('bump_storefront_cache_version') &&
    migration.includes('get_storefront_cache_version'),
});

tests.push({
  name: 'invalidation flushes edge prefixes and requests purge',
  pass: read('src/services/storefrontProductService.ts').includes('requestEdgeStorefrontPurge'),
});

tests.push({
  name: 'checkout bumps cache version on stock-affecting orders',
  pass: read('src/services/orderService.ts').includes('bumpVersion: true'),
});

const passed = tests.filter((t) => t.pass).length;
console.log('\nEdge cache architecture validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
