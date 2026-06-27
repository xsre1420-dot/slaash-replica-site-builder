#!/usr/bin/env node
/**
 * Phase 1 — Run EXPLAIN (ANALYZE, BUFFERS) on hot-path queries via platform_benchmark_hot_queries RPC.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env (service_role only).
 *
 * Usage:
 *   node scripts/sql-explain-benchmark.mjs [--save-before|--save-after]
 *   node scripts/sql-explain-benchmark.mjs --compare
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
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
const BEFORE = join(OUT_DIR, 'explain-before.json');
const AFTER = join(OUT_DIR, 'explain-after.json');

const parsePlan = (planJson) => {
  if (!planJson || typeof planJson !== 'object') return null;
  const root = Array.isArray(planJson) ? planJson[0]?.Plan : planJson.Plan ?? planJson;
  if (!root) return null;
  const walk = (node, acc = { seqScans: 0, indexScans: 0, sorts: 0, maxRows: 0 }) => {
    if (!node) return acc;
    if (node['Node Type'] === 'Seq Scan') acc.seqScans += 1;
    if (node['Node Type']?.includes('Index')) acc.indexScans += 1;
    if (node['Node Type'] === 'Sort') acc.sorts += 1;
    acc.maxRows = Math.max(acc.maxRows, node['Actual Rows'] ?? 0);
    for (const child of node.Plans ?? []) walk(child, acc);
    return acc;
  };
  return {
    planningMs: planJson[0]?.['Planning Time'] ?? planJson['Planning Time'] ?? null,
    executionMs: planJson[0]?.['Execution Time'] ?? planJson['Execution Time'] ?? root['Actual Total Time'] ?? null,
    rootNode: root['Node Type'],
    actualRows: root['Actual Rows'],
    sharedHit: root['Shared Hit Blocks'],
    sharedRead: root['Shared Read Blocks'],
    ...walk(root),
  };
};

const summarizeBenchmark = (data) => {
  const queries = data?.queries ?? [];
  return queries.map((q) => ({
    name: q.name,
    ...parsePlan(q.plan),
    executionMs: q.execution_ms ?? parsePlan(q.plan)?.executionMs,
    planningMs: q.planning_ms ?? parsePlan(q.plan)?.planningMs,
  }));
};

const runBenchmark = async () => {
  if (!url || !key) {
    console.error('✗ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/rpc/platform_benchmark_hot_queries`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_warm_cache: true }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error('✗ Invalid JSON response:', text.slice(0, 500));
    process.exit(1);
  }

  if (!res.ok) {
    console.error('✗ RPC failed:', res.status, json);
    process.exit(1);
  }

  return json;
};

const compare = (before, after) => {
  const bMap = new Map((before.queries ?? []).map((q) => [q.name, q]));
  const rows = [];
  for (const aq of after.queries ?? []) {
    const bq = bMap.get(aq.name);
    const bExec = bq?.execution_ms ?? parsePlan(bq?.plan)?.executionMs ?? null;
    const aExec = aq.execution_ms ?? parsePlan(aq.plan)?.executionMs ?? null;
    const delta =
      bExec != null && aExec != null && bExec > 0
        ? `${(((bExec - aExec) / bExec) * 100).toFixed(1)}%`
        : '—';
    rows.push({ name: aq.name, beforeMs: bExec, afterMs: aExec, improvement: delta });
  }
  return rows;
};

const main = async () => {
  const args = process.argv.slice(2);

  if (args.includes('--compare')) {
    if (!existsSync(BEFORE) || !existsSync(AFTER)) {
      console.error('✗ Need both explain-before.json and explain-after.json');
      process.exit(1);
    }
    const before = JSON.parse(readFileSync(BEFORE, 'utf8'));
    const after = JSON.parse(readFileSync(AFTER, 'utf8'));
    const rows = compare(before, after);
    console.log('\n=== Before vs After (execution ms) ===\n');
    console.table(rows);
    const improved = rows.filter((r) => r.beforeMs != null && r.afterMs != null && r.afterMs < r.beforeMs);
    const avg =
      improved.length > 0
        ? (
            improved.reduce((s, r) => s + (r.beforeMs - r.afterMs) / r.beforeMs, 0) / improved.length
          ).toFixed(1)
        : '0';
    console.log(`\nAverage improvement (improved queries): ${avg}%`);
    return;
  }

  console.log('Running platform_benchmark_hot_queries (EXPLAIN ANALYZE, BUFFERS)…');
  const result = await runBenchmark();

  if (!existsSync(OUT_DIR)) {
    await import('fs').then(({ mkdirSync }) => mkdirSync(OUT_DIR, { recursive: true }));
  }

  const outfile = args.includes('--save-after') ? AFTER : args.includes('--save-before') ? BEFORE : join(OUT_DIR, 'explain-latest.json');
  writeFileSync(outfile, JSON.stringify(result, null, 2));

  const summary = summarizeBenchmark(result);
  console.log(`✓ Saved → ${outfile}`);
  console.log('\n=== Hot-path execution summary ===\n');
  console.table(summary);

  const seqScanQueries = summary.filter((s) => (s.seqScans ?? 0) > 0);
  if (seqScanQueries.length) {
    console.warn('\n⚠ Queries with sequential scans:', seqScanQueries.map((q) => q.name).join(', '));
  } else {
    console.log('\n✓ No unnecessary sequential scans detected in benchmark set');
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
