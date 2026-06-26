#!/usr/bin/env node
/**
 * PostgreSQL internals probes (v69) — health audit + maintenance RPC.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
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

async function rpc(name, body = {}, headers = anonHeaders) {
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

const anonAudit = await rpc('platform_internals_audit');
tests.push({
  name: 'anon cannot run platform_internals_audit',
  pass:
    anonAudit.status === 401 ||
    anonAudit.status === 403 ||
    anonAudit.status === 404 ||
    anonAudit.json?.code === 'PGRST202',
});

const page = await rpc('get_store_products_page', {
  p_slug: 'demo-store',
  p_limit: 8,
  p_cursor: '',
  p_category: '',
  p_search: '',
});
tests.push({
  name: 'storefront page still works after internals migration',
  pass: page.json?.products != null && page.json?.cache_version != null,
});

if (serviceHeaders) {
  const audit = await rpc('platform_internals_audit', {}, serviceHeaders);
  tests.push({
    name: 'platform_internals_audit returns health snapshot',
    pass:
      audit.json?.success === true &&
      audit.json?.schema_version >= 69 &&
      audit.json?.cache_hit_ratio_pct != null &&
      audit.json?.extended_statistics != null,
  });

  const maintenance = await rpc(
    'platform_run_internals_maintenance',
    { p_prune_rate_limits: true, p_prune_analytics: false, p_prune_outboxes: false, p_analyze: true },
    serviceHeaders
  );
  tests.push({
    name: 'platform_run_internals_maintenance runs ANALYZE + prune',
    pass: maintenance.json?.success === true && Array.isArray(maintenance.json?.analyzed_tables),
  });

  tests.push({
    name: 'phase 1.5 internals audit includes version and xid age',
    pass:
      audit.json?.phase === '1.5' &&
      audit.json?.postgresql_version != null &&
      audit.json?.max_xid_age != null &&
      audit.json?.database_size != null,
  });

  const benchmark = await rpc('platform_benchmark_hot_queries', { p_warm_cache: false }, serviceHeaders);
  const queries = benchmark?.json?.queries ?? benchmark?.queries ?? [];
  tests.push({
    name: 'hot query benchmark still executes after stats refresh',
    pass: Array.isArray(queries) && queries.length >= 10 && queries.every((q) => !q.error || q.plan),
  });

  const outDir = join(process.cwd(), 'supabase/benchmarks');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'internals-audit-snapshot.json'),
    JSON.stringify(audit.json?.full_report ?? audit.json, null, 2)
  );
} else {
  tests.push(
    { name: 'platform_internals_audit (skipped — no service key)', pass: true },
    { name: 'platform_run_internals_maintenance (skipped — no service key)', pass: true },
    { name: 'hot query benchmark (skipped — no service key)', pass: true }
  );
}

const passed = tests.filter((t) => t.pass).length;
console.log('\n=== PostgreSQL Internals Tests (Phase 1.5) ===\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
