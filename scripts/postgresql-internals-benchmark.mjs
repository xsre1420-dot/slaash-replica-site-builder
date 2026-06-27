#!/usr/bin/env node
/**
 * PostgreSQL internals benchmark — Phase 1.5 audit + maintenance snapshot.
 * Usage: node scripts/postgresql-internals-benchmark.mjs [--save]
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
const OUT = join(OUT_DIR, 'postgresql-internals-phase-1.5.json');

async function rpc(name, body = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
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

function computeScore(audit) {
  let score = 0;
  const cache = Number(audit?.cache_hit_ratio_pct ?? 0);
  if (cache >= 99) score += 20;
  else if (cache >= 95) score += 15;
  else if (cache >= 90) score += 8;

  const heap = Number(audit?.heap_hit_ratio_pct ?? 0);
  if (heap >= 99) score += 10;
  else if (heap >= 95) score += 6;

  const seq = Number(audit?.seq_scan_ratio_pct ?? 100);
  if (seq < 5) score += 15;
  else if (seq < 15) score += 10;
  else if (seq < 30) score += 5;

  const xid = Number(audit?.max_xid_age ?? 0);
  if (xid < 500000000) score += 10;
  else if (xid < 1000000000) score += 5;

  const ext = audit?.extended_statistics;
  if (Array.isArray(ext) && ext.length >= 7) score += 15;
  else if (Array.isArray(ext) && ext.length >= 4) score += 8;

  if ((audit?.bloat_candidates ?? 99) === 0) score += 10;
  else if ((audit?.bloat_candidates ?? 99) <= 2) score += 5;

  if ((audit?.unused_index_count ?? 99) <= 3) score += 5;
  if (audit?.healthy === true) score += 10;

  return Math.min(100, score);
}

const main = async () => {
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const save = process.argv.includes('--save');
  const audit = await rpc('platform_internals_audit', {});
  let bench = null;
  try {
    bench = await rpc('platform_postgresql_internals_benchmark', {});
  } catch {
    bench = null;
  }

  const summary = {
    benchmark_at: new Date().toISOString(),
    phase: '1.5',
    enterprise_postgresql_score: computeScore(audit),
    audit,
    maintenance: bench
      ? {
          duration_ms: bench.maintenance_duration_ms,
          before_cache_hit: bench.before?.database?.cache_hit_ratio_pct,
          after_cache_hit: bench.after?.database?.cache_hit_ratio_pct,
          recommendations: bench.recommendations,
        }
      : null,
    estimates: {
      bloat_reduction_pct: '20-40% (aggressive autovacuum + fillfactor HOT)',
      planner_accuracy_improvement_pct: '15-30% (extended stats + ANALYZE targets)',
      buffer_cache_improvement_pct: '2-8% (reduced dead tuples + pruning)',
      wal_reduction_pct: '10-20% (HOT updates + outbox pruning)',
      temp_file_reduction_pct: '15-25% (better cardinality estimates)',
    },
  };

  console.log('\nPostgreSQL internals benchmark (Phase 1.5)\n');
  console.log(`Enterprise PostgreSQL Score: ${summary.enterprise_postgresql_score}/100\n`);
  console.log('Version:', audit.postgresql_version);
  console.log('Database size:', audit.database_size?.pretty);
  console.log('Cache hit ratio:', `${audit.cache_hit_ratio_pct}%`);
  console.log('Seq scan ratio:', `${audit.seq_scan_ratio_pct}%`);
  console.log('Max XID age:', audit.max_xid_age);
  console.log('Extended statistics:', (audit.extended_statistics ?? []).length);
  console.log('Bloat candidates:', audit.bloat_candidates);
  console.log('Healthy:', audit.healthy);

  if (save) {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, JSON.stringify(summary, null, 2));
    console.log(`\n✓ Saved ${OUT}`);
  }

  process.exit(audit.healthy === true ? 0 : 1);
};

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
