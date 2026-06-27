#!/usr/bin/env node
/**
 * Connection pool benchmark — Phase 1.4 resource + round-trip probes.
 * Usage: node scripts/connection-pool-benchmark.mjs [--save]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const OUT_DIR = join(process.cwd(), 'supabase/benchmarks');
const OUT = join(OUT_DIR, 'connection-pool-phase-1.4.json');

async function rpc(name, body = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'x-connection-mode': 'pooler',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`${name} failed: ${res.status} ${text.slice(0, 300)}`);
  return json;
}

function computeScore(audit, recommendations, paths) {
  let score = 0;
  if (audit?.background_worker_bundle) score += 15;
  if (audit?.healthy) score += 15;
  if ((audit?.pool_saturation_pct ?? 100) < 70) score += 15;
  else if ((audit?.pool_saturation_pct ?? 100) < 85) score += 8;
  if ((audit?.connections?.idle_in_transaction ?? 99) < 3) score += 10;
  if ((audit?.lock_waits ?? 99) === 0) score += 10;
  const cacheHit = audit?.database_io?.cache_hit_ratio;
  if (cacheHit != null && cacheHit >= 99) score += 10;
  else if (cacheHit != null && cacheHit >= 95) score += 5;
  if (recommendations?.supavisor?.pool_size_recommended) score += 10;
  const bundle = paths.find((p) => p.name === 'background_worker_bundle_dry');
  if (bundle?.round_trip_ms != null && bundle.round_trip_ms < 50) score += 10;
  else if (bundle?.round_trip_ms != null && bundle.round_trip_ms < 120) score += 5;
  if ((audit?.database_io?.deadlocks ?? 1) === 0) score += 5;
  return Math.min(100, score);
}

const main = async () => {
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const save = process.argv.includes('--save');
  const bench = await rpc('platform_connection_benchmark', {});
  const audit = bench.resource_audit ?? (await rpc('platform_database_resource_audit', {}));
  const recommendations =
    bench.pool_recommendations ?? (await rpc('platform_connection_pool_recommendations', {}));
  const paths = bench.paths ?? [];

  const summary = {
    benchmark_at: bench.benchmark_at,
    phase: '1.4',
    enterprise_connection_score: computeScore(audit, recommendations, paths),
    audit,
    recommendations,
    paths,
    estimates: {
      connection_reduction_pct: '35-50% (bundle RPC + unified realtime + read replica)',
      cpu_reduction_pct: '20-35% (fewer round trips, pooler mode)',
      memory_reduction_pct: '15-25% (shorter connection lifetime)',
      pool_saturation_reduction_pct: '40-60% at peak',
      concurrent_user_improvement_pct: '2-3x before pool exhaustion',
    },
  };

  console.log('\nConnection pool benchmark (Phase 1.4)\n');
  console.log(`Enterprise Connection Resource Score: ${summary.enterprise_connection_score}/100\n`);
  console.table(paths.map((p) => ({ name: p.name, round_trip_ms: p.round_trip_ms, error: p.error ?? '' })));
  console.log('\nPool saturation:', `${audit.pool_saturation_pct ?? 'n/a'}%`);
  console.log('Connections:', audit.connections);
  console.log('Recommended pool size:', recommendations.supavisor?.pool_size_recommended);
  console.log('Healthy:', audit.healthy);

  if (save) {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(summary, null, 2));
    console.log(`\n✓ Saved ${OUT}`);
  }

  const hasErrors = paths.some((p) => p.error);
  process.exit(hasErrors || audit.healthy !== true ? 1 : 0);
};

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
