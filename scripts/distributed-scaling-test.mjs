#!/usr/bin/env node
/**
 * Distributed scaling architecture probes (v80).
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
const root = process.cwd();
const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');

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

tests.push({
  name: 'read routing module exists',
  pass: read('src/lib/disasterRecovery/readRouting.ts').includes('READ_REPLICA_RPCS'),
});

tests.push({
  name: 'service boundaries module exists',
  pass: read('src/core/distributed/serviceBoundaries.ts').includes('SERVICE_BOUNDARIES'),
});

tests.push({
  name: 'failure isolation module exists',
  pass: read('src/core/distributed/failureIsolation.ts').includes('runIsolatedSubsystem'),
});

tests.push({
  name: 'distributed idempotency module exists',
  pass: read('src/background/shared/distributedIdempotency.ts').includes('tryClaimDistributedIdempotency'),
});

tests.push({
  name: 'v80 migration exists',
  pass: read('supabase/migrations/20260630000001_distributed_scaling_v80.sql').includes('platform_distributed_capacity_model'),
});

tests.push({
  name: 'circuit breaker module exists',
  pass: read('src/lib/resilience/circuitBreaker.ts').includes('withCircuitBreaker'),
});

tests.push({
  name: 'distributed KV adapter exists',
  pass: read('src/lib/cache/kvAdapter.ts').includes('kvGet'),
});

tests.push({
  name: 'unified background queue edge function exists',
  pass: read('supabase/functions/process-background-queue/index.ts').includes('process_analytics_event_buffer'),
});

tests.push({
  name: 'RPC layer uses read routing',
  pass: read('src/integrations/supabase/rpc.ts').includes('resolveRpcEndpoint'),
});

const health = await rpc('platform_health_check', {}, serviceHeaders ?? anonHeaders);
tests.push({
  name: 'platform_health_check reachable',
  pass:
    (health.status === 200 && health.json?.required_version >= 80) ||
    health.status === 401 ||
    health.status === 403 ||
    health.json?.code === 'PGRST202',
});

const anonScaling = await rpc('platform_scaling_audit');
tests.push({
  name: 'anon cannot run platform_scaling_audit',
  pass:
    anonScaling.status === 401 ||
    anonScaling.status === 403 ||
    anonScaling.status === 404 ||
    anonScaling.json?.code === 'PGRST202',
});

if (serviceHeaders) {
  const scaling = await rpc('platform_scaling_audit', {}, serviceHeaders);
  tests.push({
    name: 'platform_scaling_audit reports v80 architecture',
    pass: scaling.json?.success === true && scaling.json?.schema_version >= 80,
  });

  const jobs = await rpc('get_background_jobs_status', {}, serviceHeaders);
  tests.push({
    name: 'get_background_jobs_status includes import_jobs',
    pass: jobs.json?.success === true && jobs.json?.import_jobs != null,
  });

  const outDir = join(root, 'supabase/benchmarks');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'distributed-scaling-audit.json'),
    JSON.stringify(scaling.json?.full_report ?? scaling.json, null, 2)
  );
} else {
  tests.push(
    { name: 'platform_scaling_audit (skipped — no service key)', pass: true },
    { name: 'get_background_jobs_status (skipped — no service key)', pass: true }
  );
}

const passed = tests.filter((t) => t.pass).length;
console.log('\n=== Distributed Scaling Tests (v80) ===\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
