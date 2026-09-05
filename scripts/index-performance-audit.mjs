#!/usr/bin/env node
/**
 * Index performance audit — EXPLAIN hot paths + production index inventory.
 * Usage: node scripts/index-performance-audit.mjs [--save] [--slug=bidaya-demo]
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

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
const url = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = join(process.cwd(), 'supabase/benchmarks/index-performance-audit.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const walkPlan = (node, acc = { seqScans: 0, indexOnly: 0, indexScans: 0, nodes: [] }) => {
  if (!node) return acc;
  const type = node['Node Type'] || '';
  if (type === 'Seq Scan') acc.seqScans += 1;
  if (type.includes('Index')) acc.indexScans += 1;
  if (type === 'Index Only Scan') acc.indexOnly += 1;
  if (type === 'Seq Scan' || type.includes('Index')) {
    acc.nodes.push({
      type,
      relation: node['Relation Name'] || node['Index Name'] || null,
      rows: node['Actual Rows'],
    });
  }
  for (const child of node.Plans ?? []) walkPlan(child, acc);
  return acc;
};

const summarize = (q) => {
  const root = q.plan?.[0]?.Plan;
  const w = walkPlan(root);
  return {
    name: q.name,
    ms: q.execution_ms ?? null,
    error: q.error ?? null,
    seqScans: w.seqScans,
    indexScans: w.indexScans,
    indexOnly: w.indexOnly,
    topScan: w.nodes[0] ?? null,
  };
};

async function rpc(fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${fn}: ${JSON.stringify(json)}`);
  return json;
}

function cliIndexStats() {
  const sql = `
    SELECT relname AS table, indexrelname AS index, idx_scan, idx_tup_read,
           pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND relname IN (
        'products','orders','order_items','inventory_movements',
        'analytics_event_outbox','order_side_effects_outbox','order_webhook_outbox'
      )
    ORDER BY relname, idx_scan DESC;
  `;
  const r = spawnSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout).rows ?? [];
  } catch {
    return null;
  }
}

async function main() {
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('=== Index Performance Audit ===\n');

  const explain = await rpc('platform_index_explain_hot_paths', {
    p_slug: args.slug || null,
    p_owner_id: args.owner || null,
    p_warm_cache: false,
  });

  const rows = (explain.queries ?? []).map((q) =>
    summarize({
      name: q.name,
      execution_ms: q.execution_ms,
      error: q.error,
      plan: q.plan,
    })
  );

  console.table(rows);

  const failures = rows.filter((r) => r.error || r.seqScans > 0);
  if (failures.length) {
    console.log('\n⚠ Paths with seq scan or errors:');
    failures.forEach((f) => console.log(`  ${f.name}: seq=${f.seqScans} err=${f.error ?? '—'}`));
  } else {
    console.log('\n✓ All hot paths use index scans');
  }

  const indexStats = cliIndexStats();
  if (indexStats) {
    const zeroScan = indexStats.filter((i) => Number(i.idx_scan) === 0);
    console.log(`\nIndex usage: ${indexStats.length} indexes, ${zeroScan.length} with zero scans`);
  }

  const report = {
    auditedAt: new Date().toISOString(),
    ownerId: explain.owner_id,
    slug: explain.slug,
    explainSummaries: rows,
    indexStats,
  };

  if (args.save) {
    if (!existsSync(join(process.cwd(), 'supabase/benchmarks'))) {
      mkdirSync(join(process.cwd(), 'supabase/benchmarks'), { recursive: true });
    }
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(`\nSaved → ${OUT}`);
  }

  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
