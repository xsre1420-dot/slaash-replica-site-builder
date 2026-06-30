#!/usr/bin/env node
/**
 * Large dataset benchmark — v79 platform_large_dataset_benchmark.
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
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[large-dataset-benchmark] Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

const res = await fetch(`${url}/rest/v1/rpc/platform_large_dataset_benchmark`, {
  method: 'POST',
  headers,
  body: JSON.stringify({}),
});
const data = await res.json();

const outDir = join(process.cwd(), 'supabase/benchmarks');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'large-dataset-benchmark.json'), JSON.stringify(data, null, 2));

console.log('\n=== Large Dataset Benchmark (v79) ===\n');

for (const q of data.queries ?? []) {
  const ms = q.execution_ms != null ? `${Number(q.execution_ms).toFixed(2)}ms` : q.error ?? 'n/a';
  console.log(`${String(q.name).padEnd(28)} ${ms.padStart(12)}  ${q.root_node ?? ''}`);
}

console.log('\nScale simulation (partition pruning):');
for (const s of data.scale_simulation ?? []) {
  console.log(
    `  ${(Number(s.simulated_rows) / 1e6).toFixed(0).padStart(3)}M rows → pruning ${s.partition_pruning ? 'YES' : 'NO'}`
  );
}

if (data.tenant_stats) {
  console.log('\nTenant stats:', JSON.stringify(data.tenant_stats, null, 2));
}

console.log(`\nFull report → supabase/benchmarks/large-dataset-benchmark.json\n`);
