#!/usr/bin/env node
/**
 * Verify Supabase connectivity + platform schema.
 * Prefers SUPABASE_SERVICE_ROLE_KEY for platform_health_check (anon is denied after v13+).
 * Usage: node scripts/verify-platform-db.mjs
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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const key = serviceKey || anonKey;

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const pass = (msg) => console.log(`✓ ${msg}`);

if (!url || !key) {
  fail(
    'Missing VITE_SUPABASE_URL and key (SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY)'
  );
}

pass(`Supabase URL: ${url}`);
if (serviceKey) {
  pass('Using service role key for platform_health_check');
} else {
  console.warn('⚠ Using anon key — platform_health_check may be denied (set SUPABASE_SERVICE_ROLE_KEY in .env)');
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

const rpc = async (fn, body = {}) => {
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
  return { ok: res.ok, status: res.status, json };
};

const { ok, status, json } = await rpc('platform_health_check');
const healthOk =
  json &&
  typeof json === 'object' &&
  (json.ok === true || json.message === 'ok');

if (ok && healthOk) {
  pass(`platform_health_check OK (schema v${json.schema_version}, required v${json.required_version ?? 26})`);
  process.exit(0);
}

if (status === 403 || status === 401 || json?.code === '42501') {
  fail(
    'permission denied for platform_health_check — add SUPABASE_SERVICE_ROLE_KEY to .env (Dashboard → Settings → API)'
  );
}

if (status === 404 || String(json?.message || json).includes('Could not find')) {
  fail(
    'platform_health_check RPC missing — apply migrations: npm run db:deploy'
  );
}

if (json && typeof json === 'object') {
  console.log('Platform health response:', JSON.stringify(json, null, 2));
  fail(`Database schema out of sync (${(json.missing || []).length} missing items)`);
}

fail(`Health check failed (HTTP ${status})`);
