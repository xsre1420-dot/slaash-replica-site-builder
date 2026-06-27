#!/usr/bin/env node
/**
 * Chaos engineering architecture validation (static + test inventory).
 * Usage: node scripts/chaos-audit-test.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');

const tests = [];

const orderService = read('src/services/orderService.ts');
const checkoutRecovery = read('src/services/checkoutRecoveryService.ts');
const checkoutSession = read('src/utils/checkoutSession.ts');
const hub = read('src/lib/merchantRealtimeHub.ts');
const failover = read('src/lib/disasterRecovery/failover.ts');

tests.push({
  name: 'order RPC retry on network errors (max 3)',
  pass: orderService.includes('maxAttempts = 3') && orderService.includes('isRetryableOrderError'),
});

tests.push({
  name: 'checkout recovery after transport failure',
  pass:
    checkoutRecovery.includes('get_order_by_idempotency_key') &&
    orderService.includes('tryRecoverCheckoutOrder'),
});

tests.push({
  name: 'concurrent order dedup (inflightOrders)',
  pass: orderService.includes('inflightOrders') && read('src/services/orderService.test.ts').includes('deduplicates concurrent createOrder'),
});

tests.push({
  name: 'idempotency key in sessionStorage',
  pass: checkoutSession.includes('getOrCreateIdempotencyKey') && checkoutSession.includes('sessionStorage'),
});

tests.push({
  name: 'cross-tab checkout submit lock',
  pass: checkoutSession.includes('checkout-cross-lock') || checkoutSession.includes('acquireCheckoutSubmitLock'),
});

tests.push({
  name: 'realtime reconnect with max attempts + teardown',
  pass: hub.includes('MAX_RECONNECT_ATTEMPTS') && hub.includes('teardownMerchantRealtimeHub'),
});

tests.push({
  name: 'disaster recovery failover module',
  pass: failover.includes('activateFailover') && failover.includes('checkEndpointHealth'),
});

tests.push({
  name: 'rapid-click product create coalescing',
  pass: read('src/lib/resilienceBehaviors.test.ts').includes('coalesces concurrent product create'),
});

tests.push({
  name: 'atomic order RPC in migrations',
  pass: read('supabase/migrations/20260612000001_comprehensive_security_fixes.sql').includes('create_order_with_stock_deduction'),
});

tests.push({
  name: 'chaos/reliability reports present',
  pass:
    existsSync(join(root, 'supabase/CHAOS_TESTING_REPORT.md')) &&
    existsSync(join(root, 'supabase/FAILURE_RECOVERY_REPORT.md')) &&
    existsSync(join(root, 'supabase/RELIABILITY_REPORT.md')),
});

const passed = tests.filter((t) => t.pass).length;
console.log('\nChaos engineering architecture validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
