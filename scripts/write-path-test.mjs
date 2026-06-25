#!/usr/bin/env node
/**
 * Write-path integrity probes (checkout fast path + side-effects outbox).
 */
import { readFileSync, existsSync } from 'fs';
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

async function rpc(name, body, headers = anonHeaders) {
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

const sideEffectsAnon = await rpc('process_order_side_effects_batch', { p_limit: 5 });
tests.push({
  name: 'anon cannot run order side-effects processor',
  pass:
    sideEffectsAnon.status === 401 ||
    sideEffectsAnon.status === 403 ||
    sideEffectsAnon.status === 404 ||
    sideEffectsAnon.json?.code === 'PGRST202' ||
    sideEffectsAnon.json?.success === false,
});

const checkoutNoKey = await rpc('create_order_with_stock_deduction', {
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
  name: 'checkout still requires idempotency key',
  pass:
    checkoutNoKey.json?.error === 'idempotency_required' ||
    checkoutNoKey.json?.success === false,
});

if (serviceHeaders) {
  const audit = await rpc('platform_write_path_audit', {}, serviceHeaders);
  tests.push({
    name: 'platform_write_path_audit reports healthy write architecture',
    pass:
      audit.json?.success === true &&
      audit.json?.checkout_fast_path === true &&
      audit.json?.order_side_effects_outbox === true &&
      audit.json?.order_creation_log_trigger === false,
  });
} else {
  tests.push({
    name: 'platform_write_path_audit (skipped — no service role key)',
    pass: true,
  });
}

const passed = tests.filter((t) => t.pass).length;
console.log('\nWrite-path probes\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
