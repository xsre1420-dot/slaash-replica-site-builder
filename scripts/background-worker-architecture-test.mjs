#!/usr/bin/env node
/**
 * Background worker architecture — static + live failure/recovery probes.
 *
 * Usage:
 *   node scripts/background-worker-architecture-test.mjs
 *   node scripts/background-worker-architecture-test.mjs --save
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const save = process.argv.includes('--save');

const loadEnv = () => {
  const out = {};
  for (const name of ['.env', '.env.local']) {
    const path = join(ROOT, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
      if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
  return out;
};

const env = { ...process.env, ...loadEnv() };
const url = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const read = (rel) => {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
};

const checks = [];
const assert = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
};

const migration = read('supabase/migrations/20260906000007_worker_architecture_hardening.sql');
const edgeBundle = read('supabase/functions/process-background-queue/index.ts');
const edgeWebhook = read('supabase/functions/process-order-webhook-outbox/index.ts');

assert('worker architecture migration exists', migration.length > 500);

assert(
  'worker registry table seeded',
  migration.includes('platform_worker_registry') &&
    migration.includes('process_background_worker_bundle') &&
    migration.includes('process-order-webhook-outbox')
);

assert(
  'unified heartbeat recorder',
  migration.includes('record_platform_worker_heartbeat') &&
    migration.includes('last_failure_at') &&
    migration.includes('consecutive_failures')
);

assert(
  'conditional pg_cron fallbacks',
  migration.includes('process_analytics_event_buffer_cron_fallback') &&
    migration.includes('process_order_side_effects_batch_cron_fallback') &&
    migration.includes('_worker_recently_succeeded')
);

assert(
  'worker health audit RPC',
  migration.includes('platform_worker_health_audit') &&
    migration.includes('pg_cron_jobs')
);

assert(
  'pg_cron worker-health-check scheduled',
  migration.includes("'worker-health-check'") &&
    migration.includes('platform_worker_health_audit()')
);

assert(
  'edge bundle records failure heartbeat on fallback',
  edgeBundle.includes('record_platform_worker_heartbeat') &&
    edgeBundle.includes('process_background_worker_bundle')
);

assert(
  'webhook edge records heartbeat',
  edgeWebhook.includes('record_platform_worker_heartbeat') &&
    edgeWebhook.includes('process-order-webhook-outbox')
);

assert(
  'app exposes worker health audit',
  read('src/services/backgroundJobsService.ts').includes('fetchWorkerHealthAudit') &&
    read('src/lib/supabase/schemaCapabilities.ts').includes('hasWorkerHealthAuditRpc')
);

assert(
  'server job catalog documents primary/fallback',
  read('src/lib/infrastructure/serverJobCatalog.ts').includes('worker.health_audit') &&
    read('src/lib/infrastructure/serverJobCatalog.ts').includes('pg_cron conditional fallback')
);

async function rpc(name, body, headers) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
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

const anonHeaders = anonKey
  ? { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
  : null;

const serviceHeaders = serviceKey
  ? { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
  : null;

if (anonHeaders && url) {
  const probe = await rpc('platform_worker_health_audit', {}, anonHeaders);
  assert(
    'anon blocked from worker health audit',
    probe.status === 401 ||
      probe.status === 403 ||
      probe.json?.code === 'PGRST202' ||
      (typeof probe.json?.message === 'string' &&
        probe.json.message.toLowerCase().includes('service_role'))
  );
} else {
  assert('live auth probes (skipped — no anon/url)', true);
}

if (serviceHeaders && url) {
  const healthProbe = await rpc('platform_worker_health_audit', {}, serviceHeaders);
  assert(
    'service role runs worker health audit',
    healthProbe.json?.overall != null && Array.isArray(healthProbe.json?.workers),
    healthProbe.text.slice(0, 200)
  );

  const statusProbe = await rpc('get_background_jobs_status', {}, serviceHeaders);
  assert(
    'background status includes workers summary',
    statusProbe.json?.success === true &&
      Object.prototype.hasOwnProperty.call(statusProbe.json.workers ?? {}, 'bundle_stale'),
    statusProbe.text.slice(0, 200)
  );

  const fallbackProbe = await rpc('process_analytics_event_buffer_cron_fallback', {}, serviceHeaders);
  assert(
    'analytics cron fallback callable',
    fallbackProbe.json?.skipped != null || fallbackProbe.json?.processed != null,
    fallbackProbe.text.slice(0, 200)
  );

  const heartbeatProbe = await rpc(
    'record_platform_worker_heartbeat',
    {
      p_worker_id: 'architecture-test-probe',
      p_success: true,
      p_result: { probe: true },
      p_error: null,
    },
    serviceHeaders
  );
  assert(
    'heartbeat recorder accepts probe',
    heartbeatProbe.json?.success === true,
    heartbeatProbe.text.slice(0, 200)
  );
} else {
  assert('live service probes (skipped — no service key)', true, 'missing SUPABASE_SERVICE_ROLE_KEY');
}

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);

console.log('\nBackground worker architecture probes\n');
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail && !c.pass ? ` — ${c.detail}` : ''}`);
}
console.log(`\n${passed}/${checks.length} passed\n`);

if (save) {
  const outDir = join(ROOT, 'supabase/benchmarks');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'background-worker-architecture-test.json'),
    JSON.stringify({ audited_at: new Date().toISOString(), passed, total: checks.length, checks }, null, 2)
  );
  console.log('Saved supabase/benchmarks/background-worker-architecture-test.json');
}

process.exit(failed.length === 0 ? 0 : 1);
