#!/usr/bin/env node
/** Save benchmark from supabase db query output to explain-after.json */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const OUT_DIR = join(process.cwd(), 'supabase/benchmarks');
const OUT = join(OUT_DIR, 'explain-after.json');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const raw = execSync('supabase db query --linked -f scripts/benchmark-hot-paths.sql', {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

const jsonStart = raw.indexOf('{');
const jsonEnd = raw.lastIndexOf('}');
if (jsonStart < 0) {
  console.error('No JSON in output');
  process.exit(1);
}

const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
const benchmark = parsed.rows?.[0]?.benchmark ?? parsed;
writeFileSync(OUT, JSON.stringify(benchmark, null, 2));
console.log(`✓ Saved ${OUT}`);
console.table(
  (benchmark.queries ?? []).map((q) => ({
    name: q.name,
    execution_ms: q.execution_ms,
    planning_ms: q.planning_ms,
    error: q.error ?? '',
  }))
);
