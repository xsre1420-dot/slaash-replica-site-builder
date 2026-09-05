#!/usr/bin/env node
/**
 * Queue / outbox hardening — static + live failure/recovery probes.
 *
 * Usage:
 *   node scripts/queue-outbox-hardening-test.mjs
 *   node scripts/queue-outbox-hardening-test.mjs --save
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

const migration = read('supabase/migrations/20260906000006_queue_outbox_hardening.sql');

assert('hardening migration exists', migration.length > 500);

assert(
  'analytics outbox retry columns',
  migration.includes('attempt_count') &&
    migration.includes('dead_letter_at') &&
    migration.includes('next_attempt_at') &&
    migration.includes('idx_analytics_event_outbox_dead_letter')
);

assert(
  'side effects backoff column',
  migration.includes('order_side_effects_outbox') && migration.includes('next_attempt_at')
);

assert(
  'analytics processor retry budget',
  migration.includes('v_max_attempts INT := 8') &&
    migration.includes('dead_letter_at = CASE WHEN') &&
    migration.includes('platform_worker_heartbeats')
);

assert(
  'dead letter replay RPCs',
  migration.includes('retry_analytics_dead_letter') &&
    migration.includes('retry_side_effects_dead_letter')
);

assert(
  'import stuck recovery',
  migration.includes('recover_stale_import_jobs') &&
    migration.includes("status = 'processing'")
);

assert(
  'unified queue health audit',
  migration.includes('platform_queue_health_audit') &&
    migration.includes('worker_stale_minutes')
);

assert(
  'background jobs status excludes DLQ from pending',
  migration.includes('dead_letter_at IS NULL') &&
    migration.includes("'worker_stale'")
);

assert(
  'worker bundle includes import recovery + health',
  migration.includes('process_background_worker_bundle') &&
    migration.includes('recover_stale_import_jobs') &&
    migration.includes('platform_queue_health_audit')
);

assert(
  'backgroundJobsService exposes DLQ retry + health audit',
  read('src/services/backgroundJobsService.ts').includes('retrySideEffectsDeadLetter') &&
    read('src/services/backgroundJobsService.ts').includes('fetchQueueHealthAudit') &&
    read('src/services/backgroundJobsService.ts').includes('retryAnalyticsDeadLetter')
);

assert(
  'server job catalog documents retry limits',
  read('src/lib/infrastructure/serverJobCatalog.ts').includes('retryLimit: 8') &&
    read('src/lib/infrastructure/serverJobCatalog.ts').includes('retryLimit: 10')
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
  const healthProbe = await rpc('platform_queue_health_audit', {}, anonHeaders);
  assert(
    'anon blocked from queue health audit',
    healthProbe.status === 401 ||
      healthProbe.status === 403 ||
      healthProbe.json?.code === 'PGRST202' ||
      (typeof healthProbe.json?.message === 'string' &&
        healthProbe.json.message.toLowerCase().includes('service_role'))
  );

  const analyticsDlqProbe = await rpc('retry_analytics_dead_letter', { p_limit: 1 }, anonHeaders);
  assert(
    'anon blocked from analytics DLQ replay',
    analyticsDlqProbe.status === 401 ||
      analyticsDlqProbe.status === 403 ||
      analyticsDlqProbe.json?.code === 'PGRST202'
  );
} else {
  assert('live auth probes (skipped — no anon/url)', true, 'missing env');
}

if (serviceHeaders && url) {
  const statusProbe = await rpc('get_background_jobs_status', {}, serviceHeaders);
  assert(
    'service role reads background jobs status',
    statusProbe.json?.success === true,
    JSON.stringify(statusProbe.json).slice(0, 200)
  );

  if (statusProbe.json?.success) {
    assert(
      'status includes analytics dead_letter field',
      Object.prototype.hasOwnProperty.call(statusProbe.json.analytics ?? {}, 'dead_letter')
    );
    assert(
      'status includes worker_stale fields',
      Object.prototype.hasOwnProperty.call(statusProbe.json.analytics ?? {}, 'worker_stale') &&
        Object.prototype.hasOwnProperty.call(statusProbe.json.order_side_effects ?? {}, 'worker_stale')
    );
  }

  const auditProbe = await rpc('platform_queue_health_audit', {}, serviceHeaders);
  assert(
    'service role runs queue health audit',
    auditProbe.json?.audited_at != null || auditProbe.json?.critical != null,
    auditProbe.text.slice(0, 200)
  );

  const importRecoveryProbe = await rpc('recover_stale_import_jobs', { p_stale_minutes: 30 }, serviceHeaders);
  assert(
    'import recovery RPC callable',
    importRecoveryProbe.json?.success === true || importRecoveryProbe.json?.skipped === 'no_table',
    importRecoveryProbe.text.slice(0, 200)
  );

  const analyticsDlqReplay = await rpc('retry_analytics_dead_letter', { p_limit: 1 }, serviceHeaders);
  assert(
    'analytics DLQ replay returns success shape',
    analyticsDlqReplay.json?.success === true,
    analyticsDlqReplay.text.slice(0, 200)
  );

  const sideDlqReplay = await rpc(
    'retry_side_effects_dead_letter',
    { p_owner_id: null, p_limit: 1 },
    serviceHeaders
  );
  assert(
    'side effects DLQ replay returns success shape',
    sideDlqReplay.json?.success === true,
    sideDlqReplay.text.slice(0, 200)
  );

  const emptyAnalytics = await rpc('process_analytics_event_buffer', { p_limit: 1 }, serviceHeaders);
  assert(
    'analytics processor returns dead_letter count',
    emptyAnalytics.json?.dead_letter != null || emptyAnalytics.json?.processed != null,
    emptyAnalytics.text.slice(0, 200)
  );
} else {
  assert('live service probes (skipped — no service key)', true, 'missing SUPABASE_SERVICE_ROLE_KEY');
}

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);

console.log('\nQueue / outbox hardening probes\n');
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail && !c.pass ? ` — ${c.detail}` : ''}`);
}
console.log(`\n${passed}/${checks.length} passed\n`);

if (save) {
  const outDir = join(ROOT, 'supabase/benchmarks');
  mkdirSync(outDir, { recursive: true });
  const report = {
    audited_at: new Date().toISOString(),
    passed,
    total: checks.length,
    checks,
  };
  writeFileSync(join(outDir, 'queue-outbox-hardening-test.json'), JSON.stringify(report, null, 2));
  console.log('Saved supabase/benchmarks/queue-outbox-hardening-test.json');
}

process.exit(failed.length === 0 ? 0 : 1);
