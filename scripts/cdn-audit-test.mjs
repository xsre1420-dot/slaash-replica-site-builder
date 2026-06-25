#!/usr/bin/env node
/**
 * CDN & media delivery architecture validation.
 * Usage: node scripts/cdn-audit-test.mjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const tests = [];

const cdn = read('src/utils/cdnMediaUtils.ts');
const upload = read('src/utils/imageUpload.ts');
const optimized = read('src/components/OptimizedImage.tsx');
const sw = read('public/sw.js');

tests.push({
  name: 'cdnMediaUtils resolves thumbnail and display variants',
  pass: cdn.includes('resolveMediaDeliveryUrl') && cdn.includes('resolveThumbnailUrl'),
});

tests.push({
  name: 'upload sets 1-year cacheControl on storage objects',
  pass: upload.includes("cacheControl: '31536000'"),
});

tests.push({
  name: 'UUID paths enable immutable asset versioning',
  pass: cdn.includes('isVersionedStorageAsset'),
});

tests.push({
  name: 'OptimizedImage supports CDN thumbnail variant',
  pass: optimized.includes('variant') && optimized.includes('resolveMediaDeliveryUrl'),
});

tests.push({
  name: 'ProductCard uses thumbnail variant',
  pass: read('src/components/store/ProductCard.tsx').includes('variant="thumbnail"'),
});

tests.push({
  name: 'media audit helpers detect oversize and duplicates',
  pass: cdn.includes('auditMediaUrlSet') && cdn.includes('analyzeMediaUrl'),
});

tests.push({
  name: 'service worker cache-first for supabase storage',
  pass: sw.includes('/storage/') && sw.includes('cache.match'),
});

tests.push({
  name: 'storage audit script exists for origin analysis',
  pass: read('scripts/storage-audit.mjs').includes('largeObjects'),
});

const passed = tests.filter((t) => t.pass).length;
console.log('\nCDN & media delivery validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
