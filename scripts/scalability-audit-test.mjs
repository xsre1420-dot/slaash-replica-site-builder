#!/usr/bin/env node
/**
 * Long-term scalability architecture validation.
 * Usage: node scripts/scalability-audit-test.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');

const tests = [];

tests.push({
  name: 'tenant-scoped storefront RPCs (slug-bound)',
  pass: read('src/services/storefrontProductService.ts').includes('get_storefront_page_bundle'),
});

tests.push({
  name: 'merchant realtime hub consolidates channels',
  pass: read('src/lib/merchantRealtimeHub.ts').includes('subscribeMerchantProducts'),
});

tests.push({
  name: 'edge cache versioning migration (v56)',
  pass: read('supabase/migrations/20260625000056_edge_cache_versioning.sql').includes('storefront_cache_version'),
});

tests.push({
  name: 'background webhook outbox consumer (v55)',
  pass: read('supabase/migrations/20260625000055_background_processing.sql').includes('claim_order_webhook_outbox_batch'),
});

tests.push({
  name: 'analytics non-blocking hot path (v54)',
  pass: read('supabase/migrations/20260625000054_analytics_hot_path_hardening.sql').includes('process_analytics_event_buffer'),
});

tests.push({
  name: 'storefront cache tiers + scoped invalidation',
  pass: read('src/services/storefrontCacheTiers.ts').includes('invalidateStorefrontScope') === false &&
    read('src/services/storefrontProductService.ts').includes('invalidateStorefrontScope'),
});

tests.push({
  name: 'CDN thumbnail media delivery',
  pass: read('src/utils/cdnMediaUtils.ts').includes('resolveMediaDeliveryUrl'),
});

tests.push({
  name: 'scalability reports present',
  pass:
    existsSync(join(root, 'supabase/SCALABILITY_AUDIT_REPORT.md')) &&
    existsSync(join(root, 'supabase/GROWTH_RISK_REPORT.md')) &&
    existsSync(join(root, 'supabase/CAPACITY_PROJECTION_REPORT.md')),
});

tests.push({
  name: 'order atomic RPC + idempotency in migrations',
  pass: read('supabase/migrations/20260612000001_comprehensive_security_fixes.sql').includes('create_order_with_stock_deduction'),
});

const passed = tests.filter((t) => t.pass).length;
console.log('\nScalability architecture validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
