#!/usr/bin/env node
/**
 * Tenant isolation smoke tests (read-only + safe RPC probes).
 * Usage: node scripts/tenant-isolation-test.mjs
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

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or anon key');
  process.exit(1);
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json',
};

const VICTIM_OWNER = '00000000-0000-0000-0000-000000000001';
const VICTIM_ORDER = '00000000-0000-0000-0000-000000000002';
const FAKE_KEY = 'probe-isolation-' + Date.now();

const tests = [];

async function rpc(name, body) {
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
    json = text;
  }
  return { status: res.status, json, text };
}

async function tableSelect(table, query) {
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 200) };
}

// 1) Direct table access blocked by RLS
const ordersProbe = await tableSelect('orders', 'select=id&limit=1');
tests.push({
  name: 'anon cannot list orders',
  pass: ordersProbe.status === 200 && (ordersProbe.text.includes('[]') || ordersProbe.text === '[]'),
});

const productsProbe = await tableSelect('products', 'select=id,name&limit=5');
tests.push({
  name: 'anon cannot read merchant products table',
  pass: productsProbe.status === 200 && !productsProbe.text.includes('"name"'),
});

const statsProbe = await rpc('get_store_statistics', {
  p_owner_id: VICTIM_OWNER,
  p_start: '2000-01-01T00:00:00Z',
  p_end: '2030-01-01T00:00:00Z',
});
tests.push({
  name: 'anon cannot read victim store statistics',
  pass: statsProbe.json === null || statsProbe.json?.order_count === undefined,
});

const dashboardProbe = await rpc('get_dashboard_statistics_batch', {
  p_owner_id: VICTIM_OWNER,
});
tests.push({
  name: 'anon cannot read victim dashboard batch',
  pass: dashboardProbe.json === null || dashboardProbe.status === 401,
});

const listOrdersProbe = await rpc('list_merchant_orders', {
  p_owner_id: VICTIM_OWNER,
  p_page: 0,
  p_page_size: 10,
});
tests.push({
  name: 'anon cannot list victim merchant orders',
  pass: listOrdersProbe.status === 401 || String(listOrdersProbe.text).includes('Unauthorized'),
});

// 2) checkout_resolve_duplicate_order locked down
const checkoutResolveProbe = await rpc('checkout_resolve_duplicate_order', {
  p_owner_id: VICTIM_OWNER,
  p_idempotency_key: FAKE_KEY,
});
tests.push({
  name: 'checkout_resolve_duplicate_order not callable by anon',
  pass:
    checkoutResolveProbe.status === 404 ||
    String(checkoutResolveProbe.text).includes('Could not find') ||
    checkoutResolveProbe.status === 401 ||
    checkoutResolveProbe.status === 403,
});

// 3) get_order_by_idempotency_key ignores spoofed owner_id for anon
const recoverSpoof = await rpc('get_order_by_idempotency_key', {
  p_idempotency_key: FAKE_KEY,
  p_owner_id: VICTIM_OWNER,
  p_store_slug: null,
});
tests.push({
  name: 'checkout recovery ignores anon spoofed owner_id',
  pass: recoverSpoof.json?.found === false || recoverSpoof.json?.found === undefined,
});

// 4) increment_product_stock forbidden for anon
const restockProbe = await rpc('increment_product_stock', {
  p_product_id: VICTIM_ORDER,
  p_owner_id: VICTIM_OWNER,
  p_delta: 1,
});
tests.push({
  name: 'anon cannot restock victim inventory',
  pass:
    restockProbe.status === 401 ||
    restockProbe.json?.error === 'forbidden' ||
    restockProbe.json?.success === false,
});

// 5) publish victim product blocked
const publishProbe = await rpc('publish_owner_product', {
  p_product_id: VICTIM_ORDER,
});
tests.push({
  name: 'anon cannot publish victim product',
  pass: publishProbe.json?.success === false || publishProbe.json?.error === 'unauthorized',
});

// 6) Storefront slug path still works (public by design)
const storefrontProbe = await rpc('get_store_products_page', {
  p_slug: 'bidaya-demo',
  p_limit: 1,
  p_cursor: '',
  p_category: '',
  p_search: '',
});
tests.push({
  name: 'public storefront RPC still works',
  pass: storefrontProbe.status === 200 && typeof storefrontProbe.json === 'object',
});

console.log('=== Tenant Isolation Tests ===');
console.log(`URL: ${url}\n`);

let failed = 0;
for (const t of tests) {
  const icon = t.pass ? '✓' : '✗';
  console.log(`${icon} ${t.name}`);
  if (!t.pass) failed++;
}

console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
