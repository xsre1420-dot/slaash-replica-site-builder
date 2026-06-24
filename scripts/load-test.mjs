#!/usr/bin/env node
/**
 * Platform capacity probe — simulates concurrent storefront + API traffic.
 * Usage: node scripts/load-test.mjs [--users=50] [--duration=15] [--slug=demo]
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
const baseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const CONCURRENT_USERS = Number(args.users) || 50;
const DURATION_SEC = Number(args.duration) || 12;
const REQUEST_TIMEOUT_MS = Number(args.timeout) || 12000;

if (!baseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or anon key in .env');
  process.exit(1);
}

const rpc = async (fn, body, signal) => {
  const started = performance.now();
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
    signal,
  });
  const elapsed = performance.now() - started;
  const text = await res.text();
  let ok = res.ok;
  if (res.ok && text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.success === false || parsed?.error) ok = false;
      if (parsed === null && (fn === 'get_store_meta' || fn === 'get_store_products_page' || fn === 'get_storefront_page_bundle')) ok = false;
    } catch {
      /* non-json ok */
    }
  }
  return { ok, status: res.status, elapsed, fn };
};

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
};

async function validateSlug(slug) {
  try {
    const res = await fetch(`${baseUrl}/rest/v1/rpc/get_store_meta`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data != null && typeof data === 'object' && data.store != null;
  } catch {
    return false;
  }
}

async function fetchFirstSlug() {
  if (args.slug && args.slug !== 'true') {
    const valid = await validateSlug(args.slug);
    return valid ? args.slug : args.slug;
  }
  try {
    const res = await fetch(`${baseUrl}/rest/v1/rpc/list_public_store_slugs`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: 20, p_offset: 0 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    for (const row of data) {
      const slug = row?.store_slug;
      if (slug && (await validateSlug(slug))) return slug;
    }
    return data[0]?.store_slug ?? null;
  } catch {
    return null;
  }
}

/** One virtual customer session: browse store (+ visit if slug is live) */
async function customerSession(slug, signal, mode) {
  const results = [];
  const calls =
    mode === 'infra'
      ? [
          () => rpc('list_public_store_slugs', { p_limit: 20, p_offset: 0 }, signal),
          () =>
            rpc(
              'get_store_products_page',
              { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
              signal
            ),
          () => rpc('list_public_store_slugs', { p_limit: 10, p_offset: 0 }, signal),
        ]
      : [
          () =>
            rpc(
              'get_storefront_page_bundle',
              { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
              signal
            ),
          () =>
            rpc(
              'get_store_products_page',
              { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
              signal
            ),
          () =>
            rpc('track_store_visit_by_slug', {
              p_store_slug: slug,
              p_page_path: `/store/${slug}`,
              p_user_agent: 'SlaashLoadTest/1.0',
            }, signal),
        ];
  for (const call of calls) {
    try {
      results.push(await call());
    } catch (err) {
      results.push({ ok: false, status: 0, elapsed: REQUEST_TIMEOUT_MS, error: err.message });
    }
  }
  return results;
}

async function runPhase(label, users, durationSec, slug, sessionMode) {
  const latencies = [];
  let success = 0;
  let failed = 0;
  const statusCounts = {};
  const endAt = Date.now() + durationSec * 1000;
  let iterations = 0;

  const workers = Array.from({ length: users }, async () => {
    while (Date.now() < endAt) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const batch = await customerSession(slug, controller.signal, sessionMode);
        for (const r of batch) {
          iterations += 1;
          latencies.push(r.elapsed);
          if (r.ok) success += 1;
          else {
            failed += 1;
            const key = String(r.status || 'timeout');
            statusCounts[key] = (statusCounts[key] || 0) + 1;
          }
        }
      } catch {
        failed += 3;
        iterations += 3;
        statusCounts.timeout = (statusCounts.timeout || 0) + 3;
      } finally {
        clearTimeout(timer);
      }
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));
    }
  });

  await Promise.all(workers);

  const total = success + failed;
  const rps = total / durationSec;
  const errorRate = total ? (failed / total) * 100 : 100;

  return {
    label,
    users,
    durationSec,
    totalRequests: total,
    success,
    failed,
    errorRate,
    rps,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies.length ? Math.max(...latencies) : 0,
    statusCounts,
  };
}

const grade = (errorRate, p95) => {
  if (errorRate > 10 || p95 > 8000) return 'fail';
  if (errorRate > 2 || p95 > 3000) return 'degraded';
  return 'ok';
};

const estimateCapacity = (phases) => {
  const okPhases = phases.filter((p) => grade(p.errorRate, p.p95) === 'ok');
  const degraded = phases.filter((p) => grade(p.errorRate, p.p95) === 'degraded');
  const maxOk = okPhases.length ? Math.max(...okPhases.map((p) => p.users)) : 0;
  const maxDegraded = degraded.length ? Math.max(...degraded.map((p) => p.users)) : 0;

  return {
    comfortableConcurrentBrowsers: maxOk,
    degradedConcurrentBrowsers: maxDegraded > maxOk ? maxDegraded : null,
    hardLimitEstimate: maxDegraded || maxOk,
  };
};

console.log('═══════════════════════════════════════════════════');
console.log('  Slaash Platform — Load / Capacity Probe');
console.log('═══════════════════════════════════════════════════');
console.log(`Target: ${baseUrl.replace(/https?:\/\//, '').split('.')[0]}…supabase.co`);
console.log(`Phases: ramp concurrent storefront users\n`);

const slugArg = args.slug && args.slug !== 'true' ? args.slug : null;
let slug = slugArg;
let sessionMode = 'full';

if (slug) {
  const valid = await validateSlug(slug);
  sessionMode = valid ? 'full' : 'infra';
} else {
  slug = await fetchFirstSlug();
  if (slug) {
    sessionMode = (await validateSlug(slug)) ? 'full' : 'infra';
  }
}

if (!slug) {
  slug = 'load-test-probe';
  sessionMode = 'infra';
  console.log('No published store slug — infra probe (sitemap + RPC throughput).\n');
} else {
  console.log(`Store slug: ${slug} (${sessionMode === 'full' ? 'full storefront' : 'infra'} mode)\n`);
}

const userLevels = [10, 25, 50, 100, 200, 500, 1000, 2500, 5000, 10000].filter((n) => n <= Math.max(CONCURRENT_USERS, 10000));
const uniqueLevels = [...new Set(userLevels)];
if (!uniqueLevels.includes(CONCURRENT_USERS)) uniqueLevels.push(CONCURRENT_USERS);
uniqueLevels.sort((a, b) => a - b);

const phases = [];
for (const users of uniqueLevels) {
  process.stdout.write(`▶ ${users} concurrent users (${DURATION_SEC}s)… `);
  const result = await runPhase(`${users} users`, users, DURATION_SEC, slug, sessionMode);
  phases.push(result);
  const g = grade(result.errorRate, result.p95);
  console.log(
    `${g === 'ok' ? '✓' : g === 'degraded' ? '⚠' : '✗'} ` +
      `${result.rps.toFixed(1)} req/s | err ${result.errorRate.toFixed(1)}% | p95 ${result.p95.toFixed(0)}ms`
  );
  if (g === 'fail' && users >= 100) break;
  await new Promise((r) => setTimeout(r, 2000));
}

const capacity = estimateCapacity(phases);

console.log('\n────────────────── Results ──────────────────');
console.log('Phase       Users  Req/s   Err%    p50     p95     p99');
for (const p of phases) {
  console.log(
    `${p.label.padEnd(11)} ${String(p.users).padStart(5)}  ${p.rps.toFixed(1).padStart(6)}  ${p.errorRate.toFixed(1).padStart(5)}%  ${p.p50.toFixed(0).padStart(6)}  ${p.p95.toFixed(0).padStart(6)}  ${p.p99.toFixed(0).padStart(6)}`
  );
}

console.log('\n────────────────── Capacity Estimate ──────────────────');
console.log(`Comfortable concurrent storefront visitors: ~${capacity.comfortableConcurrentBrowsers}`);
if (capacity.degradedConcurrentBrowsers) {
  console.log(`Degraded but functional up to:              ~${capacity.degradedConcurrentBrowsers}`);
}
console.log(`Observed breaking point (this run):         ~${capacity.hardLimitEstimate || 'not reached'}`);

const last = phases[phases.length - 1];
if (last?.statusCounts && Object.keys(last.statusCounts).length) {
  console.log('\nError breakdown (last phase):', last.statusCounts);
}

console.log('\n────────────────── Notes ──────────────────');
console.log('• Test simulates: store meta + product list + visit tracking per user.');
console.log('• Checkout/orders NOT load-tested (would affect real inventory).');
console.log('• Supabase plan limits (connections, CPU) dominate at scale.');
console.log('• Enable VITE_SUPABASE_POOLER_URL + Pro plan for 500+ concurrent users.');
console.log('═══════════════════════════════════════════════════\n');
