#!/usr/bin/env node
/**
 * Database growth audit — calls platform_database_growth_audit (v78).
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

if (!url || !serviceKey) {
  console.error('[growth-audit] Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function rpc(name, body = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, json: { raw: text } };
  }
}

const audit = await rpc('platform_database_growth_audit');
if (audit.json?.tables == null) {
  console.error('[growth-audit] RPC failed:', audit.status, audit.json);
  process.exit(1);
}

const outDir = join(process.cwd(), 'supabase/benchmarks');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'database-growth-audit.json');
writeFileSync(outPath, JSON.stringify(audit.json, null, 2));

console.log('\n=== Database Growth Audit (v78) ===\n');
console.log(`Schema version: ${audit.json.schema_version}`);
console.log(`Assumption: ${audit.json.platform_scale_assumption}\n`);

const tables = audit.json.tables ?? [];
console.log(
  'Table'.padEnd(28) +
    'Rows'.padStart(12) +
    'Size'.padStart(12) +
    'Risk'.padStart(10) +
    'Strategy'.padStart(18)
);
console.log('-'.repeat(80));

for (const t of tables) {
  console.log(
    String(t.table_name).padEnd(28) +
      String(t.live_rows ?? 0).padStart(12) +
      String(t.total_size ?? '-').padStart(12) +
      String(t.bottleneck_risk ?? '-').padStart(10) +
      String(t.partition_strategy ?? 'none').padStart(18)
  );
}

const critical = audit.json.bottleneck_tables ?? [];
console.log(`\nBottleneck tables: ${critical.length}`);
for (const b of critical) {
  console.log(`  • ${b.table_name} (${b.bottleneck_risk}) — ${b.projected_size_100m_rows} at 100M rows`);
}

console.log(`\nFull report → ${outPath}\n`);
