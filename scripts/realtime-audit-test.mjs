#!/usr/bin/env node
/**
 * Realtime architecture static validation.
 * Usage: node scripts/realtime-audit-test.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const tests = [];

const hub = read('src/lib/merchantRealtimeHub.ts');
tests.push({
  name: 'merchantRealtimeHub centralizes channels',
  pass: hub.includes('subscribeMerchantProducts') && hub.includes('subscribeMerchantOrders'),
});

tests.push({
  name: 'hub tracks event metrics',
  pass: hub.includes('hubMetrics') && hub.includes('getMerchantRealtimeHubStatus'),
});

tests.push({
  name: 'logout tears down hub',
  pass: read('src/context/AuthContext.tsx').includes('teardownMerchantRealtimeHub'),
});

tests.push({
  name: 'failover tears down hub',
  pass: read('src/lib/disasterRecovery/supabaseClient.ts').includes('teardownMerchantRealtimeHub'),
});

const pageChannelUsage = [];
for (const rel of [
  'src/pages/Products.tsx',
  'src/pages/Inventory.tsx',
  'src/pages/Orders.tsx',
  'src/pages/Statistics.tsx',
  'src/components/dashboard/DashboardOverview.tsx',
]) {
  const src = read(rel);
  if (/supabase\.channel\(/.test(src)) {
    pageChannelUsage.push(rel);
  }
}

tests.push({
  name: 'pages do not create direct supabase.channel()',
  pass: pageChannelUsage.length === 0,
});

tests.push({
  name: 'product noise fields expanded',
  pass: read('src/lib/merchantRealtimeUtils.ts').includes('seo_title'),
});

const passed = tests.filter((t) => t.pass).length;
console.log('\nRealtime architecture validation\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
if (pageChannelUsage.length) {
  console.log('\nDirect channel usage:', pageChannelUsage.join(', '));
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
