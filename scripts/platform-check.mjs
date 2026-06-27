#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const loadEnv = () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return out;
};

const env = { ...process.env, ...loadEnv() };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase env vars in .env');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

async function get(path) {
  const res = await fetch(`${url}${path}`, { headers });
  return { status: res.status, ok: res.ok, body: await res.text() };
}

async function rpc(fn, body = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
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
  return { status: res.status, ok: res.ok, json };
}

const tables = ['profiles', 'stores', 'products', 'orders', 'store_visits'];
console.log(`Project: ${url}\n`);

for (const table of tables) {
  const r = await get(`/rest/v1/${table}?select=id&limit=1`);
  const label =
    r.status === 200 ? 'OK' : r.status === 404 ? 'MISSING' : r.status === 401 ? 'AUTH' : `HTTP ${r.status}`;
  console.log(`[${label}] table ${table}`);
}

const health = await rpc('platform_health_check');
if (health.ok && health.json?.ok) {
  console.log(`[OK] platform_health_check (schema v${health.json.schema_version})`);
} else {
  console.log(`[FAIL] platform_health_check`, health.status, typeof health.json === 'object' ? JSON.stringify(health.json) : health.json);
}

const username = await rpc('is_username_available', { p_username: 'slaash_check_user' });
console.log(
  `[${username.ok ? 'OK' : 'FAIL'}] is_username_available`,
  username.ok ? username.json : username.status
);

const auth = await get('/auth/v1/settings');
console.log(`[${auth.ok ? 'OK' : 'FAIL'}] auth settings`, auth.status);
