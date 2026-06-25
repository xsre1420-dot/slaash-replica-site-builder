#!/usr/bin/env node
/**
 * Storefront caching architecture static validation.
 * Usage: node scripts/storefront-cache-audit-test.mjs
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const tests = [];

const tiers = read('src/services/storefrontCacheTiers.ts');
const productService = read('src/services/storefrontProductService.ts');
const hook = read('src/hooks/useStoreProductsPage.ts');
const dummyData = read('src/data/dummyData.ts');
const storeService = read('src/services/storeService.ts');

tests.push({
  name: 'four cache tiers defined (store, product, category, settings)',
  pass:
    tiers.includes('StoreCacheKeys') &&
    tiers.includes('ProductCacheKeys') &&
    tiers.includes('CategoryCacheKeys') &&
    tiers.includes('SettingsCacheKeys'),
});

tests.push({
  name: 'scoped invalidation avoids full flush',
  pass: productService.includes('invalidateStorefrontScope') && tiers.includes('flushStorefrontProductCaches'),
});

tests.push({
  name: 'category CRUD uses categories scope when products unchanged',
  pass: dummyData.includes("invalidateStorefrontScope(user.id, 'categories')"),
});

tests.push({
  name: 'settings save uses settings scope',
  pass: storeService.includes("invalidateStorefrontScope(ownerId, 'settings')"),
});

tests.push({
  name: 'product hook skips refetch on settings/categories scope',
  pass: hook.includes("scope === 'settings'") || hook.includes('PRODUCT_SCOPES'),
});

tests.push({
  name: 'selective category/settings patch helpers exist',
  pass:
    tiers.includes('patchStorefrontCategoriesInCache') &&
    tiers.includes('patchStorefrontSettingsInCache'),
});

tests.push({
  name: 'cache metrics tracked',
  pass: tiers.includes('getStorefrontCacheMetrics'),
});

tests.push({
  name: 'product pages use unified ProductCacheKeys',
  pass: hook.includes('ProductCacheKeys.tenantPage'),
});

const passed = tests.filter((t) => t.pass).length;
console.log('\nStorefront cache architecture validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
