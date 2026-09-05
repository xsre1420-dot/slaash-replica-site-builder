#!/usr/bin/env node
/**
 * Platform capacity probe — simulates concurrent storefront + API traffic.
 * Usage: node scripts/load-test.mjs [--users=50] [--duration=15] [--slug=demo]
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  getSupabaseConnectionHeaders,
  resolveStorefrontEdgeUrl,
  shouldUseSupavisorPooler,
  getCapacityProbeHeaders,
} from './lib/supabaseConnection.mjs';
import { TabRpcGate } from './lib/rpcGate.mjs';

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
const WARMUP_REQUESTS = Number(args.warmup) || 8;
const poolerOverride =
  args.pooler === 'on' ? true : args.pooler === 'off' ? false : undefined;
const gateLimit = args.gate === 'off' ? 0 : Math.max(0, Number(args.gate) || 6);

if (!baseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or anon key in .env');
  process.exit(1);
}

const probeHeaders = getCapacityProbeHeaders(env, poolerOverride);
const connectionHeaders = probeHeaders;
const poolerEnabled = shouldUseSupavisorPooler(env, poolerOverride);
const edgeUrl = resolveStorefrontEdgeUrl(env);

const rpc = async (fn, body, signal) => {
  const started = performance.now();
  const url = `${baseUrl}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...connectionHeaders,
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
      if (
        parsed === null &&
        (fn === 'get_store_meta' || fn === 'get_store_products_page' || fn === 'get_storefront_page_bundle')
      ) {
        ok = false;
      }
      if (fn === 'track_store_visit_by_slug' && parsed?.success === true) ok = true;
    } catch {
      /* non-json ok */
    }
  }
  return { ok, status: res.status, elapsed, fn, url, body: text.slice(0, 200) };
};

const rpcWithGate = (gate) => async (fn, body, signal) => {
  let release = () => {};
  if (gate) {
    release = await gate.acquire();
  }
  try {
    return await rpc(fn, body, signal);
  } finally {
    release();
  }
};

/** Edge get-store-products returns storeInfo; direct RPC bundle returns store. */
const isValidEdgeBundlePayload = (parsed) =>
  parsed != null &&
  typeof parsed === 'object' &&
  parsed.storeInfo != null &&
  Array.isArray(parsed.products) &&
  !parsed.error;

const edgeBundle = async (slug, signal) => {
  const started = performance.now();
  const url = `${edgeUrl}?slug=${encodeURIComponent(slug)}&bundle=1&limit=24`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      ...connectionHeaders,
    },
    signal,
  });
  const elapsed = performance.now() - started;
  const text = await res.text();
  let ok = res.ok;
  if (res.ok && text) {
    try {
      const parsed = JSON.parse(text);
      ok = isValidEdgeBundlePayload(parsed);
    } catch {
      ok = false;
    }
  }
  return { ok, status: res.status, elapsed, fn: 'edge:get-store-products', url, body: text.slice(0, 200) };
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
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        ...connectionHeaders,
      },
      body: JSON.stringify({ p_slug: slug, p_include_policies: false }),
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
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        ...connectionHeaders,
      },
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

/** One virtual customer session — matches production client (bundle critical; visit deferred). */
async function customerSession(slug, signal, mode, callRpc) {
  const results = [];
  const fireDeferredVisit = () => {
    void callRpc(
      'track_store_visit_by_slug',
      {
        p_store_slug: slug,
        p_page_path: `/store/${slug}`,
        p_user_agent: 'SlaashLoadTest/1.0',
      },
      signal
    ).catch(() => undefined);
  };

  const calls =
    mode === 'production'
      ? [
          async () => {
            if (edgeUrl) {
              const bundle = await edgeBundle(slug, signal);
              fireDeferredVisit();
              return bundle;
            }
            const bundle = await callRpc(
              'get_storefront_page_bundle',
              { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
              signal
            );
            fireDeferredVisit();
            return bundle;
          },
        ]
      : mode === 'edge'
      ? [
          async () => {
            if (!edgeUrl) {
              return { ok: false, status: 0, elapsed: 0, fn: 'edge:get-store-products', url: '', body: 'edge disabled' };
            }
            const bundle = await edgeBundle(slug, signal);
            fireDeferredVisit();
            return bundle;
          },
        ]
      : mode === 'infra'
      ? [
          () => callRpc('list_public_store_slugs', { p_limit: 20, p_offset: 0 }, signal),
          () =>
            callRpc(
              'get_store_products_page',
              { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
              signal
            ),
          () => callRpc('list_public_store_slugs', { p_limit: 10, p_offset: 0 }, signal),
        ]
      : mode === 'legacy'
        ? [
            () =>
              callRpc(
                'get_storefront_page_bundle',
                { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
                signal
              ),
            () =>
              callRpc(
                'get_store_products_page',
                { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
                signal
              ),
            () =>
              callRpc('track_store_visit_by_slug', {
                p_store_slug: slug,
                p_page_path: `/store/${slug}`,
                p_user_agent: 'SlaashLoadTest/1.0',
              }, signal),
          ]
        : mode === 'combined'
          ? [
              () =>
                callRpc(
                  'get_storefront_page_bundle',
                  { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
                  signal
                ),
              () =>
                callRpc('track_store_visit_by_slug', {
                  p_store_slug: slug,
                  p_page_path: `/store/${slug}`,
                  p_user_agent: 'SlaashLoadTest/1.0',
                }, signal),
            ]
          : [
              async () => {
                const bundle = await callRpc(
                  'get_storefront_page_bundle',
                  { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
                  signal
                );
                fireDeferredVisit();
                return bundle;
              },
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
  const errorSamples = {};
  const endAt = Date.now() + durationSec * 1000;
  let iterations = 0;

  const workers = Array.from({ length: users }, async () => {
    const gate = gateLimit > 0 ? new TabRpcGate(gateLimit) : null;
    const callRpc = rpcWithGate(gate);
    while (Date.now() < endAt) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const batch = await customerSession(slug, controller.signal, sessionMode, callRpc);
        for (const r of batch) {
          iterations += 1;
          latencies.push(r.elapsed);
          if (r.ok) success += 1;
          else {
            failed += 1;
            const key = String(r.status || 'timeout');
            statusCounts[key] = (statusCounts[key] || 0) + 1;
            if (!errorSamples[key] && r.fn) {
              errorSamples[key] = { fn: r.fn, url: r.url, body: r.body };
            }
          }
        }
      } catch {
        const rpcsPerSession =
          sessionMode === 'legacy' ? 3 : sessionMode === 'combined' ? 2 : sessionMode === 'realistic' ? 1 : 3;
        failed += rpcsPerSession;
        iterations += rpcsPerSession;
        statusCounts.timeout = (statusCounts.timeout || 0) + rpcsPerSession;
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
    errorSamples,
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
const sessionModeArg =
  args.mode === 'production'
    ? 'production'
    : args.mode === 'edge'
    ? 'edge'
    : args.mode === 'legacy'
    ? 'legacy'
    : args.mode === 'infra'
      ? 'infra'
      : args.mode === 'combined'
        ? 'combined'
        : 'realistic';
let sessionMode = sessionModeArg;

if (slug) {
  const valid = await validateSlug(slug);
  if (sessionModeArg === 'realistic') {
    sessionMode = valid ? 'realistic' : 'infra';
  } else if (sessionModeArg === 'legacy') {
    sessionMode = valid ? 'legacy' : 'infra';
  }
} else {
  slug = await fetchFirstSlug();
  if (slug && sessionModeArg === 'realistic') {
    sessionMode = (await validateSlug(slug)) ? 'realistic' : 'infra';
  } else if (slug && sessionModeArg === 'legacy') {
    sessionMode = (await validateSlug(slug)) ? 'legacy' : 'infra';
  }
}

if (!slug) {
  slug = 'load-test-probe';
  sessionMode = 'infra';
  console.log('No published store slug — infra probe (sitemap + RPC throughput).\n');
} else {
  const modeLabel =
    sessionMode === 'production'
      ? 'production (edge GET when configured, else bundle RPC + deferred visit)'
      :
    sessionMode === 'edge' ? 'production edge GET (get-store-products + deferred visit)' :
    sessionMode === 'realistic' ? 'realistic storefront (bundle RPC critical; visit deferred)' :
    sessionMode === 'combined' ? 'combined storefront (bundle + visit sequential)' :
    sessionMode === 'legacy' ? 'legacy (bundle + products + visit)' : 'infra';
  console.log(`Store slug: ${slug} (${modeLabel})`);
  console.log(
    `Connection: pooler=${poolerEnabled ? 'on' : 'off'} | edge=${edgeUrl ? 'configured' : 'off'} | gate=${gateLimit || 'off'}`
  );

  if (WARMUP_REQUESTS > 0 && sessionMode !== 'infra') {
    process.stdout.write(`Warming cache (${WARMUP_REQUESTS} requests)… `);
    const gate = gateLimit > 0 ? new TabRpcGate(gateLimit) : null;
    const callRpc = rpcWithGate(gate);
    let warmed = 0;
    for (let i = 0; i < WARMUP_REQUESTS; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        if ((sessionMode === 'edge' || sessionMode === 'production') && edgeUrl) {
          const r = await edgeBundle(slug, controller.signal);
          if (r.ok) warmed += 1;
        } else {
          const r = await callRpc(
            'get_storefront_page_bundle',
            { p_slug: slug, p_limit: 24, p_cursor: '', p_category: '', p_search: '' },
            controller.signal
          );
          if (r.ok) warmed += 1;
        }
      } catch {
        /* ignore warmup failures */
      } finally {
        clearTimeout(timer);
      }
    }
    console.log(`${warmed}/${WARMUP_REQUESTS} ok\n`);
  } else {
    console.log('');
  }
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
  if (last.errorSamples && Object.keys(last.errorSamples).length) {
    console.log('\nSample errors (last phase):');
    for (const [status, sample] of Object.entries(last.errorSamples)) {
      console.log(`  [${status}] ${sample.fn}`);
      console.log(`    URL: ${sample.url}`);
      console.log(`    Body: ${sample.body}`);
    }
  }
}

console.log('\n────────────────── Notes ──────────────────');
console.log('• Use --warmup=8 (default) to prime edge/L1 cache before ramp.');
console.log('• Production mode (--mode=production): edge GET when URL configured, else bundle RPC.');
console.log('• Combined mode: sequential bundle + track_store_visit_by_slug (diagnostic only).');
console.log('• Legacy mode (--mode=legacy): adds redundant get_store_products_page (3 RPCs).');
console.log('• Checkout/orders NOT load-tested (would affect real inventory).');
console.log('• Supabase plan limits (connections, CPU) dominate at scale.');
console.log('• Use Supavisor pooler (6543) + Pro plan for 500+ concurrent users.');
console.log('═══════════════════════════════════════════════════\n');
