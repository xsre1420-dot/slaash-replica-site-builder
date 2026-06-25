#!/usr/bin/env node
/**
 * Partitioning & data lifecycle probes (v70).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const loadEnv = () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return out;
};

const env = { ...process.env, ...loadEnv() };
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or anon key');
  process.exit(1);
}

const anonHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json',
};

const serviceHeaders = serviceKey
  ? { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
  : null;

const tests = [];

async function rpc(name, body = {}, headers = anonHeaders) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const anonAudit = await rpc('platform_lifecycle_audit');
tests.push({
  name: 'anon cannot run platform_lifecycle_audit',
  pass:
    anonAudit.status === 401 ||
    anonAudit.status === 403 ||
    anonAudit.status === 404 ||
    anonAudit.json?.code === 'PGRST202',
});

const page = await rpc('get_store_products_page', {
  p_slug: 'demo-store',
  p_limit: 8,
  p_cursor: '',
  p_category: '',
  p_search: '',
});
tests.push({
  name: 'storefront RPC still works after lifecycle migration',
  pass: page.json?.products != null,
});

const checkout = await rpc('create_order_with_stock_deduction', {
  p_order_id: null,
  p_owner_id: '00000000-0000-0000-0000-000000000001',
  p_idempotency_key: '',
  p_customer_name: 'Test',
  p_customer_phone: '0790000000',
  p_customer_address: 'Addr',
  p_total_amount: 10,
  p_customer_governorate: null,
  p_notes: null,
  p_items: [],
  p_payment_method: 'cash_on_delivery',
  p_coupon_code: null,
  p_store_slug: null,
});
tests.push({
  name: 'checkout RPC still reachable',
  pass: checkout.json?.error === 'idempotency_required' || checkout.json?.success === false,
});

if (serviceHeaders) {
  const audit = await rpc('platform_lifecycle_audit', {}, serviceHeaders);
  tests.push({
    name: 'platform_lifecycle_audit reports v70 lifecycle',
    pass:
      audit.json?.success === true &&
      audit.json?.schema_version >= 70 &&
      typeof audit.json?.partitioned_tables === 'number',
  });

  const pruning = await rpc('platform_verify_partition_pruning', { p_table: 'store_visits', p_days: 30 }, serviceHeaders);
  tests.push({
    name: 'partition pruning verification runs',
    pass: pruning.json?.success === true || pruning.json?.partitioned === false,
  });

  const archive = await rpc('archive_orders_batch', { p_older_than_days: 9999, p_batch_size: 5 }, serviceHeaders);
  tests.push({
    name: 'archive_orders_batch executes safely',
    pass: archive.json?.success === true,
  });

  const lifecycle = await rpc(
    'platform_run_data_lifecycle',
    {},
    serviceHeaders
  );
  tests.push({
    name: 'platform_run_data_lifecycle orchestrator runs',
    pass: lifecycle.json?.success === true,
  });

  const outDir = join(process.cwd(), 'supabase/benchmarks');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'lifecycle-audit-snapshot.json'),
    JSON.stringify(audit.json?.full_report ?? audit.json, null, 2)
  );
} else {
  tests.push(
    { name: 'platform_lifecycle_audit (skipped — no service key)', pass: true },
    { name: 'partition pruning (skipped — no service key)', pass: true },
    { name: 'archive_orders_batch (skipped — no service key)', pass: true },
    { name: 'platform_run_data_lifecycle (skipped — no service key)', pass: true }
  );
}

const passed = tests.filter((t) => t.pass).length;
console.log('\n=== Partitioning & Lifecycle Tests (v70) ===\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
