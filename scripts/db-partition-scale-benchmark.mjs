#!/usr/bin/env node
/**
 * Partition scale benchmark — simulates 1M–100M row query plans (v78).
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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const scenarios = [1_000_000, 10_000_000, 50_000_000, 100_000_000];

if (!url || !serviceKey) {
  console.log('\n=== Partition Scale Benchmark (offline mode) ===\n');
  console.log('No service key — using projected estimates from lifecycle policies.\n');
  for (const n of scenarios) {
    const days = Math.max(7, Math.min(365, Math.floor(n / 50_000)));
    const parts = Math.max(1, Math.ceil(days / 30));
    console.log(`${(n / 1e6).toFixed(0)}M rows → ${days}d window → ~${parts} partitions scanned (estimated)`);
  }
  process.exit(0);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

const res = await fetch(`${url}/rest/v1/rpc/platform_partition_scale_benchmark`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ p_scenarios: scenarios }),
});
const bench = await res.json();

const outDir = join(process.cwd(), 'supabase/benchmarks');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'partition-scale-benchmark.json'), JSON.stringify(bench, null, 2));

console.log('\n=== Partition Scale Benchmark (v78) ===\n');
console.log(`Planner quality: ${bench.planner_quality}`);
console.log(`Partitioned: ${bench.write_path?.partitioned}\n`);

for (const s of bench.scenarios ?? []) {
  console.log(
    `${(s.simulated_rows / 1e6).toFixed(0)}M rows | window ${s.query_window_days}d | pruning ${s.partition_pruning ? 'YES' : 'NO'} | partitions scanned ~${s.estimated_partitions_scanned}`
  );
}

console.log('\nFull report → supabase/benchmarks/partition-scale-benchmark.json\n');
process.exit(bench.scenarios?.length ? 0 : 1);
