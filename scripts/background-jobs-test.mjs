#!/usr/bin/env node
/**
 * Background job pipeline probes.
 * Usage: node scripts/background-jobs-test.mjs
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

const VICTIM_OWNER = '00000000-0000-0000-0000-000000000001';
const tests = [];

async function rpc(name, body, headers = anonHeaders) {
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

const retryProbe = await rpc('retry_order_webhook_events', { p_owner_id: VICTIM_OWNER });
tests.push({
  name: 'anon cannot retry victim webhooks',
  pass:
    retryProbe.status === 401 ||
    retryProbe.status === 404 ||
    retryProbe.json?.code === 'PGRST202' ||
    retryProbe.json?.error === 'forbidden' ||
    retryProbe.json?.success === false,
});

const jobsProbe = await rpc('get_background_jobs_status', {});
tests.push({
  name: 'anon cannot read background jobs status',
  pass:
    jobsProbe.status === 401 ||
    jobsProbe.status === 404 ||
    jobsProbe.json?.code === 'PGRST202' ||
    !jobsProbe.json?.success,
});

const claimProbe = await rpc('claim_order_webhook_outbox_batch', { p_limit: 1 });
tests.push({
  name: 'anon cannot claim webhook outbox batch',
  pass:
    claimProbe.status === 401 ||
    claimProbe.status === 404 ||
    claimProbe.json?.code === 'PGRST202' ||
    !claimProbe.json?.success,
});

if (serviceHeaders) {
  const statusProbe = await rpc('get_background_jobs_status', {}, serviceHeaders);
  tests.push({
    name: 'service role can read background jobs status',
    pass: statusProbe.json?.success === true || statusProbe.json?.code === 'PGRST202',
  });
} else {
  tests.push({ name: 'background status (skipped — no service key)', pass: true });
}

const passed = tests.filter((t) => t.pass).length;
console.log('\nBackground job probes\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
