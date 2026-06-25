#!/usr/bin/env node
/**
 * Transaction integrity probes (auth boundaries + RPC contracts).
 * Usage: node scripts/transaction-integrity-test.mjs
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
  ? {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }
  : null;

const VICTIM_OWNER = '00000000-0000-0000-0000-000000000001';
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
  return { status: res.status, json, text };
}

const checkoutNoKey = await rpc('create_order_with_stock_deduction', {
  p_order_id: null,
  p_owner_id: VICTIM_OWNER,
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
  name: 'checkout rejects missing idempotency key',
  pass:
    checkoutNoKey.json?.error === 'idempotency_required' ||
    checkoutNoKey.json?.success === false,
});

const createProductAnon = await rpc('create_merchant_product_with_stock', {
  p_owner_id: VICTIM_OWNER,
  p_payload: { name: 'x', image_url: 'https://example.com/x.jpg' },
  p_initial_stock: 1,
});
tests.push({
  name: 'anon cannot create product atomically',
  pass:
    createProductAnon.status === 401 ||
    createProductAnon.json?.error === 'forbidden' ||
    createProductAnon.json?.success === false,
});

const initialStockAnon = await rpc('record_product_initial_stock', {
  p_product_id: VICTIM_OWNER,
  p_owner_id: VICTIM_OWNER,
  p_quantity: 5,
});
tests.push({
  name: 'anon cannot record initial stock',
  pass:
    initialStockAnon.status === 401 ||
    initialStockAnon.json?.error === 'forbidden' ||
    initialStockAnon.json?.success === false,
});

const refundAnon = await rpc('record_order_refund', {
  p_order_id: VICTIM_OWNER,
  p_owner_id: VICTIM_OWNER,
  p_amount: 1,
  p_idempotency_key: 'probe-refund',
});
tests.push({
  name: 'anon cannot record refund',
  pass:
    refundAnon.status === 401 ||
    refundAnon.json?.error === 'Unauthorized' ||
    refundAnon.json?.success === false,
});

if (serviceHeaders) {
  const audit = await rpc('platform_transaction_integrity_audit', {}, serviceHeaders);
  tests.push({
    name: 'platform_transaction_integrity_audit returns healthy snapshot',
    pass: audit.json?.success === true && typeof audit.json?.healthy === 'boolean',
  });
} else {
  tests.push({
    name: 'platform_transaction_integrity_audit (skipped — no service role key)',
    pass: true,
  });
}

const passed = tests.filter((t) => t.pass).length;
console.log('\nTransaction integrity probes\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
