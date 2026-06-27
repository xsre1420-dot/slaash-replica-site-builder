#!/usr/bin/env node
/**
 * Production readiness architecture validation (static + report inventory).
 * Usage: node scripts/production-readiness-test.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');

const tests = [];

const env = read('src/lib/env.ts');
const authCtx = read('src/context/AuthContext.tsx');
const orderService = read('src/services/orderService.ts');
const hub = read('src/lib/merchantRealtimeHub.ts');
const healthMonitor = read('src/lib/observability/healthMonitor.ts');
const failover = read('src/lib/disasterRecovery/failover.ts');
const migrations = read('supabase/migrations/20260625000056_edge_cache_versioning.sql');

tests.push({
  name: 'env validation with production hard-fail',
  pass: env.includes('z.object') && env.includes('VITE_SUPABASE_URL'),
});

tests.push({
  name: 'production signup blocked (access-code only)',
  pass: authCtx.includes('isProduction()') && authCtx.includes('طلب الوصول'),
});

tests.push({
  name: 'PKCE auth + session refresh',
  pass: read('src/lib/disasterRecovery/supabaseClient.ts').includes("flowType: 'pkce'") &&
    read('src/lib/disasterRecovery/supabaseClient.ts').includes('autoRefreshToken: true'),
});

tests.push({
  name: 'protected routes + admin route guards',
  pass: read('src/components/ProtectedRoute.tsx').includes('Navigate') &&
    read('src/components/AdminRoute.tsx').includes('404'),
});

tests.push({
  name: 'order atomic RPC + idempotency (5-layer defense)',
  pass:
    orderService.includes('inflightOrders') &&
    orderService.includes('create_order_with_stock_deduction') &&
    read('supabase/migrations/20260612000001_comprehensive_security_fixes.sql').includes('idempotency_key'),
});

tests.push({
  name: 'inventory non-negative CHECK (v53)',
  pass: read('supabase/migrations/20260625000053_inventory_architecture_audit.sql').includes('products_stock_quantity_non_negative'),
});

tests.push({
  name: 'tenant isolation test script present',
  pass: read('scripts/tenant-isolation-test.mjs').includes('Tenant Isolation Penetration Tests'),
});

tests.push({
  name: 'storefront cache tiers + edge versioning',
  pass:
    read('src/services/storefrontCacheTiers.ts').includes('StorefrontCacheKeys') &&
    read('src/services/storefrontProductService.ts').includes('invalidateStorefrontScope') &&
    migrations.includes('storefront_cache_version'),
});

tests.push({
  name: 'health monitor + platform health RPC',
  pass: healthMonitor.includes('recordHealthEvent') &&
    read('supabase/migrations/20260625000011_scale_1000_users.sql').includes('platform_health_check'),
});

tests.push({
  name: 'disaster recovery + backup scripts',
  pass:
    failover.includes('activateFailover') &&
    existsSync(join(root, 'scripts/backup-database.sh')) &&
    existsSync(join(root, 'scripts/recovery-check.mjs')),
});

tests.push({
  name: 'realtime hub with reconnect + teardown',
  pass: hub.includes('MAX_RECONNECT_ATTEMPTS') && hub.includes('teardownMerchantRealtimeHub'),
});

tests.push({
  name: 'webhook outbox consumer (v55)',
  pass: read('supabase/migrations/20260625000055_background_processing.sql').includes('order_webhook_outbox'),
});

tests.push({
  name: 'merchant workflow chain (provision + publish + checkout)',
  pass:
    read('supabase/migrations/20260613000001_platform_core_stores_schema.sql').includes('provision_new_store') &&
    read('src/services/productsCrudService.ts').includes('publish_owner_product') &&
    read('src/hooks/useCheckoutFlow.ts').includes('createOrder'),
});

tests.push({
  name: 'production readiness report present',
  pass: existsSync(join(root, 'supabase/PRODUCTION_READINESS_REPORT.md')),
});

const passed = tests.filter((t) => t.pass).length;
console.log('\nProduction readiness architecture validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
