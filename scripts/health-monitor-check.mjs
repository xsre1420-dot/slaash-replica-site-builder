#!/usr/bin/env node
/**
 * Platform health monitor CLI — DB RPC + static health.json
 * Usage: node scripts/health-monitor-check.mjs [--url=http://localhost:8080]
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
const appUrl = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] ?? 'http://localhost:8080';
const supabaseUrl = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const pass = (msg) => console.log(`✓ ${msg}`);

async function main() {
  console.log('\n=== Platform Health Monitor ===\n');

  try {
    const res = await fetch(`${appUrl}/health.json`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) pass(`App health.json (${appUrl})`);
    else fail(`health.json returned ${res.status}`);
  } catch (e) {
    fail(`health.json unreachable: ${e instanceof Error ? e.message : e}`);
  }

  if (!supabaseUrl || !key) {
    console.warn('⚠ Skipping DB checks — set VITE_SUPABASE_URL + key in .env');
    process.exit(0);
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const healthRes = await fetch(`${supabaseUrl}/rest/v1/rpc/platform_health_check`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const healthText = await healthRes.text();
  let healthJson;
  try {
    healthJson = JSON.parse(healthText);
  } catch {
    fail(`platform_health_check invalid JSON: ${healthText.slice(0, 200)}`);
  }

  if (healthJson?.ok) {
    pass(`platform_health_check v${healthJson.schema_version ?? '?'}`);
  } else {
    console.warn('⚠ platform_health_check:', healthJson?.message ?? healthText.slice(0, 200));
    if (Array.isArray(healthJson?.missing) && healthJson.missing.length) {
      console.warn('  missing:', healthJson.missing.slice(0, 8).join(', '));
    }
  }

  const probes = [
    'get_dashboard_statistics_batch',
    'list_merchant_orders',
    'create_order_with_stock_deduction',
    'increment_product_stock',
  ];

  for (const fn of probes) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    const text = await res.text();
    if (text.includes('Could not find the function')) {
      fail(`RPC missing: ${fn}`);
    }
    pass(`RPC exists: ${fn}`);
  }

  console.log('\nAll health checks passed.\n');
}

main().catch((e) => fail(e.message));
