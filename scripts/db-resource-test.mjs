#!/usr/bin/env node
/**
 * Connection pool & database resource probes (v68).
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

const page = await rpc('get_store_products_page', {
  p_slug: 'demo-store',
  p_limit: 12,
  p_cursor: '',
  p_category: '',
  p_search: '',
});
tests.push({
  name: 'get_store_products_page returns cache_version',
  pass: page.json?.cache_version != null && Array.isArray(page.json?.products ?? []),
});

const auditAnon = await rpc('platform_database_resource_audit', {});
tests.push({
  name: 'anon cannot run platform_database_resource_audit',
  pass:
    auditAnon.status === 401 ||
    auditAnon.status === 403 ||
    auditAnon.status === 404 ||
    auditAnon.json?.code === 'PGRST202',
});

if (serviceHeaders) {
  const audit = await rpc('platform_database_resource_audit', {}, serviceHeaders);
  const conn = audit.json?.connections ?? {};
  tests.push({
    name: 'platform_database_resource_audit reports connection snapshot',
    pass:
      audit.json?.success === true &&
      audit.json?.phase === '1.4' &&
      typeof conn.total === 'number' &&
      typeof conn.idle_in_transaction === 'number' &&
      audit.json?.pool_saturation_pct != null &&
      audit.json?.healthy != null,
  });

  tests.push({
    name: 'process_background_worker_bundle RPC deployed',
    pass: audit.json?.background_worker_bundle === true,
  });

  const rec = await rpc('platform_connection_pool_recommendations', {}, serviceHeaders);
  tests.push({
    name: 'platform_connection_pool_recommendations returns sizing tiers',
    pass:
      rec.json?.success === true &&
      Array.isArray(rec.json?.scaling_tiers) &&
      rec.json?.supavisor?.pool_size_recommended != null,
  });
} else {
  tests.push({
    name: 'platform_database_resource_audit (skipped — no service key)',
    pass: true,
  });
}

const passed = tests.filter((t) => t.pass).length;
console.log('\n=== Database Resource Tests (v68) ===\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
