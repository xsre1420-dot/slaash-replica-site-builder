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
const VICTIM_PRODUCT = '00000000-0000-0000-0000-000000000002';
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
  return { status: res.status, text: text.slice(0, 300) };
}

function rpcBlocked(probe, { allowNull = true } = {}) {
  const leaked =
    probe.json?.success === true &&
    (probe.json?.order_id != null || probe.json?.found === true);
  if (leaked) return false;
  if (allowNull && probe.json === null) return true;
  const text = String(probe.text || '');
  return (
    probe.status === 404 ||
    probe.status === 401 ||
    probe.status === 403 ||
    probe.status === 42501 ||
    text.includes('Could not find') ||
    text.includes('permission denied') ||
    text.includes('Unauthorized') ||
    text.includes('PGRST202') ||
    text.includes('PGRST301') ||
    (probe.json?.found === false) ||
    (probe.json?.success === false)
  );
}

// --- Direct table access (RLS) ---
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

const customersProbe = await tableSelect('customers', 'select=id,phone&limit=5');
tests.push({
  name: 'anon cannot read customers table',
  pass: customersProbe.status === 200 && !customersProbe.text.includes('"phone"'),
});

const settingsProbe = await tableSelect('store_settings', 'select=owner_id,store_slug&limit=5');
tests.push({
  name: 'anon cannot enumerate store_settings',
  pass: settingsProbe.status === 200 && !settingsProbe.text.includes('store_slug'),
});

// --- Cross-tenant analytics (Store A → Store B) ---
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

const marketingProbe = await rpc('get_store_marketing_for_owner', {
  p_owner_id: VICTIM_OWNER,
});
tests.push({
  name: 'anon cannot read victim marketing settings',
  pass: marketingProbe.json === null || marketingProbe.json?.meta_pixel_id === undefined,
});

const statsBundleProbe = await rpc('get_statistics_page_bundle', {
  p_owner_id: VICTIM_OWNER,
  p_current_start: '2000-01-01T00:00:00Z',
  p_current_end: '2030-01-01T00:00:00Z',
  p_previous_start: '1999-01-01T00:00:00Z',
  p_previous_end: '1999-12-31T23:59:59Z',
});
tests.push({
  name: 'anon cannot read victim statistics page bundle',
  pass: statsBundleProbe.json === null || statsBundleProbe.json?.current === undefined,
});

const inventoryProbe = await tableSelect('inventory_movements', 'select=id&limit=1');
tests.push({
  name: 'anon cannot read inventory_movements',
  pass: inventoryProbe.status === 200 && (inventoryProbe.text.includes('[]') || inventoryProbe.text === '[]'),
});

const dailyStatsProbe = await tableSelect('store_daily_stats', 'select=owner_id&limit=1');
tests.push({
  name: 'anon cannot read store_daily_stats rollups',
  pass: dailyStatsProbe.status === 200 && !dailyStatsProbe.text.includes('owner_id'),
});

const outboxProbe = await tableSelect('analytics_event_outbox', 'select=id&limit=1');
const outboxText = String(outboxProbe.text);
const outboxBlocked =
  outboxProbe.status === 403 ||
  outboxProbe.status === 401 ||
  outboxProbe.status === 404 ||
  outboxText.includes('Could not find') ||
  outboxText.includes('PGRST205') ||
  outboxText.includes('permission denied') ||
  (outboxProbe.status === 200 &&
    (outboxText.includes('[]') || outboxText === '[]'));
tests.push({
  name: 'anon cannot read analytics_event_outbox',
  pass: outboxBlocked,
});

// --- Cross-tenant orders ---
const listOrdersProbe = await rpc('list_merchant_orders', {
  p_owner_id: VICTIM_OWNER,
  p_page: 0,
  p_page_size: 10,
});
tests.push({
  name: 'anon cannot list victim merchant orders',
  pass: listOrdersProbe.status === 401 || String(listOrdersProbe.text).includes('Unauthorized'),
});

const workflowProbe = await rpc('count_merchant_orders_by_workflow', {
  p_owner_id: VICTIM_OWNER,
});
tests.push({
  name: 'anon cannot read victim workflow counts',
  pass: workflowProbe.status === 401 || String(workflowProbe.text).includes('Unauthorized'),
});

const baseFilterProbe = await rpc('merchant_orders_base_filter', {
  p_owner_id: VICTIM_OWNER,
});
const baseFilterEmpty =
  Array.isArray(baseFilterProbe.json) && baseFilterProbe.json.length === 0;
tests.push({
  name: 'anon cannot call merchant_orders_base_filter (no rows leaked)',
  pass: rpcBlocked(baseFilterProbe) || baseFilterEmpty,
});

// --- Internal checkout probes ---
const checkoutResolveProbe = await rpc('checkout_resolve_duplicate_order', {
  p_owner_id: VICTIM_OWNER,
  p_idempotency_key: FAKE_KEY,
});
tests.push({
  name: 'checkout_resolve_duplicate_order not callable by anon (no leak)',
  pass: rpcBlocked(checkoutResolveProbe),
});

const recoverSpoof = await rpc('get_order_by_idempotency_key', {
  p_idempotency_key: FAKE_KEY,
  p_owner_id: VICTIM_OWNER,
  p_store_slug: null,
});
tests.push({
  name: 'checkout recovery ignores anon spoofed owner_id',
  pass: recoverSpoof.json?.found === false || recoverSpoof.json?.found === undefined,
});

// --- Cross-tenant inventory / products ---
const restockProbe = await rpc('increment_product_stock', {
  p_product_id: VICTIM_PRODUCT,
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

const publishProbe = await rpc('publish_owner_product', {
  p_product_id: VICTIM_PRODUCT,
});
tests.push({
  name: 'anon cannot publish victim product',
  pass: publishProbe.json?.success === false || publishProbe.json?.error === 'unauthorized',
});

const auditProbe = await rpc('audit_merchant_inventory_integrity', {
  p_owner_id: VICTIM_OWNER,
});
tests.push({
  name: 'anon cannot audit victim inventory',
  pass:
    auditProbe.status === 401 ||
    auditProbe.status === 404 ||
    auditProbe.json?.code === 'PGRST202' ||
    auditProbe.text?.includes('audit_merchant_inventory_integrity') ||
    auditProbe.json?.error === 'forbidden' ||
    auditProbe.json?.success === false,
});

const storeProbe = await rpc('get_store_for_user', {
  p_user_id: VICTIM_OWNER,
});
tests.push({
  name: 'anon cannot read victim store via get_store_for_user',
  pass: storeProbe.json === null || storeProbe.json?.store_name === undefined,
});

// --- Public storefront (intentional) ---
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

console.log('=== Tenant Isolation Penetration Tests ===');
console.log(`URL: ${url}\n`);

let failed = 0;
for (const t of tests) {
  const icon = t.pass ? '✓' : '✗';
  console.log(`${icon} ${t.name}`);
  if (!t.pass) failed++;
}

console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed > 0 ? 1 : 0);
