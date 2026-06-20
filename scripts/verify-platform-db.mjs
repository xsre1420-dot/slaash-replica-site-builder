#!/usr/bin/env node
/**
 * Verify Supabase connectivity + platform schema (uses anon key from .env).
 * Usage: node scripts/verify-platform-db.mjs
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
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const pass = (msg) => console.log(`✓ ${msg}`);

if (!url || !key) {
  fail('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env');
}

pass(`Supabase URL: ${url}`);

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
if (ok && json?.ok) {
  pass(`platform_health_check OK (schema v${json.schema_version}, required v${json.required_version ?? 10})`);
  process.exit(0);
}

if (status === 404 || String(json?.message || json).includes('Could not find')) {
  fail(
    'platform_health_check RPC missing — apply migrations: npm run db:deploy (or paste supabase/migrations/20260616*.sql in SQL Editor)'
  );
}

if (json && typeof json === 'object') {
  console.log('Platform health response:', JSON.stringify(json, null, 2));
  fail(`Database schema out of sync (${(json.missing || []).length} missing items)`);
}

fail(`Health check failed (HTTP ${status})`);
