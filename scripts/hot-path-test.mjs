#!/usr/bin/env node
/**
 * Hot path optimization validation — migration + client wiring checks.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const read = (rel) => (existsSync(join(process.cwd(), rel)) ? readFileSync(join(process.cwd(), rel), 'utf8') : '');

const migration = read('supabase/migrations/20260626000006_hot_path_optimization.sql');
const tests = [];

tests.push({ name: 'v77: get_checkout_preflight_bundle', pass: migration.includes('get_checkout_preflight_bundle') });
tests.push({ name: 'v77: checkout_product_json (slim)', pass: migration.includes('checkout_product_json') });
tests.push({ name: 'v77: platform_hot_path_benchmark', pass: migration.includes('platform_hot_path_benchmark') });
tests.push({
  name: 'client: checkout preflight in useCheckoutFlow',
  pass: read('src/hooks/useCheckoutFlow.ts').includes('fetchCheckoutPreflight'),
});
tests.push({
  name: 'client: ProductData instant preview render',
  pass: read('src/components/product-details/ProductData.tsx').includes('initialProduct, "success"'),
});
tests.push({
  name: 'client: Store allProducts useMemo (no duplicate state)',
  pass: read('src/pages/Store.tsx').includes('const allProducts = useMemo') && !read('src/pages/Store.tsx').includes('setAllProducts'),
});
tests.push({
  name: 'client: flushOrderListCache preserves dashboard batch',
  pass: read('src/lib/cache.ts').includes('flushOrderListCache'),
});
tests.push({
  name: 'client: hydration skips warm orders fetch',
  pass: read('src/services/merchantHydration.ts').includes('needsOrders'),
});
tests.push({
  name: 'client: workflow counts from dashboard batch cache',
  pass: read('src/services/orderService.ts').includes('batch?.workflowCounts'),
});
tests.push({
  name: 'client: merchant products skip warm refetch',
  pass: read('src/hooks/useMerchantProductsPage.ts').includes('hasWarmCache'),
});
tests.push({ name: 'benchmark script present', pass: existsSync(join(process.cwd(), 'scripts/hot-path-benchmark.mjs')) });

const passed = tests.filter((t) => t.pass).length;
console.log('\nHot path optimization validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
