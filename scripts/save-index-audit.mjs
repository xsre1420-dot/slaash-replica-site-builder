#!/usr/bin/env node
/** Save live index audit from Supabase CLI. */
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(process.cwd(), 'supabase/benchmarks');
const OUT = join(OUT_DIR, 'index-audit-after.json');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const raw = execSync('supabase db query --linked -f scripts/db-index-audit.sql', {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

const start = raw.indexOf('{');
const end = raw.lastIndexOf('}');
const parsed = JSON.parse(raw.slice(start, end + 1));
const audit = parsed.rows?.[0]?.audit ?? parsed;

writeFileSync(OUT, JSON.stringify(audit, null, 2));

const tables = audit.tables ?? [];
const indexes = audit.indexes ?? [];
const unused = audit.unused_indexes ?? [];

console.log(`✓ Index audit saved → ${OUT}`);
console.log(`  Tables: ${tables.length}, Indexes: ${indexes.length}, Unused (idx_scan=0): ${unused.length}`);
console.log('\nTop tables by est_rows:');
console.table(tables.slice(0, 12).map((t) => ({
  table: t.tablename,
  rows: t.est_rows,
  indexes: t.index_count,
  size: t.total_size,
})));
