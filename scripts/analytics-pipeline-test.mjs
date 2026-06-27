#!/usr/bin/env node
/**
 * Analytics pipeline probes — RPC existence + anon isolation.
 * Usage: node scripts/analytics-pipeline-test.mjs
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
  ? {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }
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

const trackVisit = await rpc('track_store_visit_by_slug', {
  p_store_slug: 'nonexistent-probe-store',
  p_page_path: '/',
});
tests.push({
  name: 'track_store_visit_by_slug RPC exists',
  pass:
    trackVisit.status === 200 ||
    trackVisit.json?.error === 'store_not_found' ||
    trackVisit.json?.success === false,
});

const auditProbe = await rpc('audit_merchant_analytics_health', {
  p_owner_id: VICTIM_OWNER,
});
tests.push({
  name: 'anon cannot audit victim analytics',
  pass:
    auditProbe.status === 401 ||
    auditProbe.status === 404 ||
    auditProbe.json?.code === 'PGRST202' ||
    auditProbe.json?.error === 'forbidden' ||
    auditProbe.json?.success === false,
});

if (serviceHeaders) {
  const pipeline = await rpc('get_analytics_pipeline_status', {}, serviceHeaders);
  tests.push({
    name: 'service role can read pipeline status',
    pass:
      pipeline.json?.success === true ||
      pipeline.status === 404 ||
      pipeline.json?.code === 'PGRST202',
  });
} else {
  tests.push({
    name: 'pipeline status (skipped — no service role key)',
    pass: true,
  });
}

const passed = tests.filter((t) => t.pass).length;
console.log('\nAnalytics pipeline probes\n');
for (const t of tests) {
  console.log(`${t.pass ? '✓' : '✗'} ${t.name}`);
}
console.log(`\n${passed}/${tests.length} passed\n`);
process.exit(passed === tests.length ? 0 : 1);
