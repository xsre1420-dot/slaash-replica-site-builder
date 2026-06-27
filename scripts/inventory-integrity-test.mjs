#!/usr/bin/env node
/**
 * Inventory integrity probes (auth + RPC contract).
 * Usage: node scripts/inventory-integrity-test.mjs
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
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

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

const restockNegative = await rpc('increment_product_stock', {
  p_product_id: VICTIM_OWNER,
  p_owner_id: VICTIM_OWNER,
  p_delta: -5,
  p_reason: 'restock',
});
tests.push({
  name: 'anon cannot decrement stock via restock RPC',
  pass:
    restockNegative.status === 401 ||
    restockNegative.json?.error === 'forbidden' ||
    restockNegative.json?.error === 'invalid_delta' ||
    restockNegative.json?.success === false,
});

const passed = tests.filter((t) => t.pass).length;
console.log('\nInventory integrity probes\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
