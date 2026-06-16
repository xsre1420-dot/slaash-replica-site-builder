#!/usr/bin/env node
/**
 * Read-only probe of live Supabase schema via PostgREST (no modifications).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const loadEnv = () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
};

const env = { ...process.env, ...loadEnv() };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'count=exact',
};

const TABLES = [
  'profiles', 'stores', 'store_settings', 'products', 'categories', 'orders',
  'order_items', 'customers', 'store_visits', 'product_reviews', 'suggested_products',
  'inventory_movements', 'product_views', 'marketing_coupons', 'marketing_settings',
  'order_refunds', 'order_chargebacks', 'order_payments', 'order_shipments',
  'subscription_plans', 'store_subscriptions', 'platform_schema_version',
  'restaurant_owners', 'marketing_attributions',
];

const RPCS = [
  'platform_health_check', 'get_store_meta', 'get_store_by_slug', 'get_store_products_page',
  'create_order_with_stock_deduction', 'resolve_checkout_owner', 'publish_owner_product',
  'get_merchant_product_reviews', 'get_store_statistics', 'get_owner_bootstrap',
  'get_owner_products_page', 'product_checkout_available_qty', 'handle_new_user',
  'is_username_available', 'attach_order_marketing_attribution',
];

const PRODUCT_COLS = [
  'id', 'is_active', 'archived_at', 'variants', 'stock_quantity', 'store_id', 'owner_id',
];
const ORDER_COLS = [
  'id', 'payment_status', 'delivery_status', 'idempotency_key', 'store_id', 'owner_id',
];

async function probeTable(name) {
  const res = await fetch(`${url}/rest/v1/${name}?select=id&limit=0`, { headers });
  const count = res.headers.get('content-range');
  if (res.ok) return { exists: true, status: res.status, count };
  const body = await res.text();
  if (res.status === 404 || body.includes('Could not find the table')) {
    return { exists: false, status: res.status, error: 'table_missing' };
  }
  if (body.includes('permission denied') || res.status === 401) {
    return { exists: 'maybe', status: res.status, error: 'rls_or_auth' };
  }
  return { exists: false, status: res.status, error: body.slice(0, 120) };
}

async function probeColumns(table, cols) {
  const select = cols.join(',');
  const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=0`, { headers });
  if (res.ok) return { ok: true, missing: [] };
  const body = await res.text();
  const missing = [];
  for (const col of cols) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${col}&limit=0`, { headers });
    if (!r.ok) missing.push(col);
  }
  return { ok: missing.length === 0, missing };
}

async function probeRpc(name) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const body = await res.text();
  if (body.includes('Could not find the function') || res.status === 404) {
    return { exists: false };
  }
  return { exists: true, status: res.status, hint: body.slice(0, 80) };
}

console.log('=== Live Supabase Schema Probe (read-only) ===');
console.log(`URL: ${url}\n`);

console.log('--- Tables ---');
const tableResults = {};
for (const t of TABLES) {
  tableResults[t] = await probeTable(t);
  const r = tableResults[t];
  const icon = r.exists === true ? '✓' : r.exists === 'maybe' ? '?' : '✗';
  console.log(`${icon} ${t}: ${JSON.stringify(r)}`);
}

console.log('\n--- Product columns ---');
console.log(JSON.stringify(await probeColumns('products', PRODUCT_COLS), null, 2));

console.log('\n--- Order columns ---');
console.log(JSON.stringify(await probeColumns('orders', ORDER_COLS), null, 2));

console.log('\n--- RPC functions ---');
const rpcResults = {};
for (const fn of RPCS) {
  rpcResults[fn] = await probeRpc(fn);
  const icon = rpcResults[fn].exists ? '✓' : '✗';
  console.log(`${icon} ${fn}`);
}

console.log('\n--- Summary JSON ---');
console.log(JSON.stringify({ tables: tableResults, rpcs: rpcResults }, null, 2));
