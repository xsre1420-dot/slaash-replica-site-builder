#!/usr/bin/env node
/**
 * Read-path benchmark — EXPLAIN ANALYZE hot queries + optional FK audit.
 * Usage:
 *   node scripts/db-read-path-benchmark.mjs [--save-after|--compare]
 *   node scripts/db-read-path-benchmark.mjs --fk-audit
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
const AFTER = join(OUT_DIR, 'explain-read-path-after.json');
const BEFORE = join(OUT_DIR, 'explain-read-path-before.json');

const parsePlan = (planJson) => {
  if (!planJson || typeof planJson !== 'object') return null;
  const root = Array.isArray(planJson) ? planJson[0]?.Plan : planJson.Plan ?? planJson;
  if (!root) return null;
  const walk = (node, acc = { seqScans: 0, indexScans: 0, sorts: 0 }) => {
    if (!node) return acc;
    if (node['Node Type'] === 'Seq Scan') acc.seqScans += 1;
    if (node['Node Type']?.includes('Index')) acc.indexScans += 1;
    if (node['Node Type'] === 'Sort') acc.sorts += 1;
    for (const child of node.Plans ?? []) walk(child, acc);
    return acc;
  };
  return {
    executionMs: planJson[0]?.['Execution Time'] ?? root['Actual Total Time'] ?? null,
    planningMs: planJson[0]?.['Planning Time'] ?? null,
    rootNode: root['Node Type'],
    actualRows: root['Actual Rows'],
    ...walk(root),
  };
};

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

const summarize = (data) =>
  (data?.queries ?? []).map((q) => ({
    name: q.name,
    error: q.error,
    ...parsePlan(q.plan),
    executionMs: q.execution_ms ?? parsePlan(q.plan)?.executionMs,
  }));

const main = async () => {
  const args = process.argv.slice(2);
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (args.includes('--fk-audit')) {
    const audit = await rpc('platform_fk_index_audit');
    const missing = audit.missing_fk_indexes ?? [];
    console.log('\nFK index audit\n');
    console.log(`Schema v${audit.schema_version}`);
    console.log(`Missing FK leading indexes: ${missing.length}`);
    for (const row of missing.slice(0, 30)) {
      console.log(`  - ${row.table}.${row.column} (${row.fk})`);
    }
    writeFileSync(join(OUT_DIR, 'fk-audit-after.json'), JSON.stringify(audit, null, 2));
    console.log(`\nSaved supabase/benchmarks/fk-audit-after.json\n`);
    return;
  }

  if (args.includes('--compare')) {
    if (!existsSync(BEFORE) || !existsSync(AFTER)) {
      console.error('Need explain-read-path-before.json and explain-read-path-after.json');
      process.exit(1);
    }
    const before = JSON.parse(readFileSync(BEFORE, 'utf8'));
    const after = JSON.parse(readFileSync(AFTER, 'utf8'));
    const bMap = new Map(summarize(before).map((q) => [q.name, q]));
    console.log('\nRead-path benchmark comparison\n');
    for (const aq of summarize(after)) {
      const bq = bMap.get(aq.name);
      const bMs = bq?.executionMs;
      const aMs = aq.executionMs;
      const delta =
        bMs != null && aMs != null && bMs > 0
          ? `${(((bMs - aMs) / bMs) * 100).toFixed(1)}%`
          : '—';
      console.log(
        `${aq.name.padEnd(28)} before=${bMs ?? '—'}ms after=${aMs ?? '—'}ms Δ ${delta} seq=${aq.seqScans ?? '?'}`
      );
    }
    return;
  }

  const bench = await rpc('platform_benchmark_hot_queries', { p_warm_cache: true });
  const outFile = args.includes('--save-before') ? BEFORE : AFTER;
  writeFileSync(outFile, JSON.stringify(bench, null, 2));

  console.log('\nRead-path EXPLAIN benchmark\n');
  console.log(`Queries: ${bench.query_count ?? bench.queries?.length ?? 0}`);
  for (const row of summarize(bench)) {
    if (row.error) {
      console.log(`✗ ${row.name}: ${row.error}`);
    } else {
      console.log(
        `✓ ${row.name.padEnd(28)} ${row.executionMs?.toFixed(2) ?? '?'}ms seq=${row.seqScans} idx=${row.indexScans}`
      );
    }
  }
  console.log(`\nSaved ${outFile.replace(process.cwd(), '.')}\n`);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
