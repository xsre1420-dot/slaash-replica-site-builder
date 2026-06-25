#!/usr/bin/env node
/**
 * Snapshot local migrations vs types.generated.ts for drift reporting.
 * Usage: node scripts/schema-snapshot.mjs [--json]
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const typesPath = join(root, 'src/integrations/supabase/types.generated.ts');
const migDir = join(root, 'supabase/migrations');

const parseTypes = () => {
  const typesSrc = readFileSync(typesPath, 'utf8');
  const pub = typesSrc.slice(typesSrc.indexOf('  public: {'));
  const tables = [];
  const functions = [];
  const tableColumns = {};
  let mode = '';
  let cur = '';
  for (const line of pub.split(/\r?\n/)) {
    if (/^\s+Tables: \{/.test(line)) { mode = 'tables'; continue; }
    if (/^\s+Views: \{/.test(line)) { mode = 'views'; continue; }
    if (/^\s+Functions: \{/.test(line)) { mode = 'functions'; continue; }
    if (/^\s+Enums: \{/.test(line)) break;
    const tm = line.match(/^\s{6}([a-z_][a-z0-9_]*): \{$/);
    if (mode === 'tables' && tm) {
      cur = tm[1];
      tables.push(cur);
      tableColumns[cur] = [];
      continue;
    }
    if (mode === 'tables' && cur && /^\s+Row: \{/.test(line)) { mode = 'row'; continue; }
    if (mode === 'row') {
      if (/^\s{6}\}/.test(line)) { mode = 'tables'; continue; }
      const cm = line.match(/^\s{10}(\w+):/);
      if (cm) tableColumns[cur].push(cm[1]);
      continue;
    }
    const fm = line.match(/^\s{6}([a-z_][a-z0-9_]*):/);
    if (mode === 'functions' && fm) functions.push(fm[1]);
  }
  return { tables, functions, tableColumns };
};

const parseLocalMigrations = () => {
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const tables = new Map();
  const fns = new Map();
  const cols = [];
  for (const f of files) {
    const sql = readFileSync(join(migDir, f), 'utf8');
    for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?(?:\s+IF NOT EXISTS)?(?: IF NOT EXISTS)?\s+public\.([a-z_][a-z0-9_]*)/gi)) {
      if (!tables.has(m[1])) tables.set(m[1], f);
    }
    for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+public\.([a-z_][a-z0-9_]*)/gi)) {
      if (!tables.has(m[1])) tables.set(m[1], f);
    }
    for (const m of sql.matchAll(/CREATE OR REPLACE FUNCTION\s+public\.([a-z_][a-z0-9_]*)/gi)) {
      fns.set(m[1], f);
    }
    for (const m of sql.matchAll(/ALTER TABLE(?: IF EXISTS)?\s+public\.([a-z_][a-z0-9_]*)\s+ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)) {
      cols.push({ table: m[1], column: m[2], file: f });
    }
  }
  return { files, tables, fns, cols };
};

const { tables: liveTables, functions: liveFns, tableColumns: liveCols } = parseTypes();
const local = parseLocalMigrations();

const missingTables = [...local.tables.keys()].filter((t) => !liveTables.includes(t)).sort();
const missingFns = [...local.fns.keys()].filter((fn) => !liveFns.includes(fn)).sort();
const missingCols = [];
for (const { table, column, file } of local.cols) {
  if (!liveTables.includes(table)) missingCols.push({ table, column, file, reason: 'table_missing' });
  else if (!liveCols[table]?.includes(column)) missingCols.push({ table, column, file, reason: 'column_missing' });
}

const frontendRpcs = [];
try {
  const { globSync } = await import('glob');
  const srcFiles = globSync('src/**/*.{ts,tsx}', { ignore: ['**/*.test.*', '**/types.generated.ts'] });
  const rpcSet = new Set();
  for (const file of srcFiles) {
    const content = readFileSync(join(root, file), 'utf8');
    for (const m of content.matchAll(/\.rpc\(\s*['"`](\w+)['"`]/g)) rpcSet.add(m[1]);
  }
  for (const rpc of [...rpcSet].sort()) {
    if (!liveFns.includes(rpc)) frontendRpcs.push(rpc);
  }
} catch { /* ignore */ }

const snapshot = {
  generatedAt: new Date().toISOString(),
  typesPath,
  counts: {
    localMigrationFiles: local.files.length,
    liveTables: liveTables.length,
    liveFunctions: liveFns.length,
    localTables: local.tables.size,
    localFunctions: local.fns.size,
    missingTables: missingTables.length,
    missingFunctions: missingFns.length,
    missingColumns: missingCols.length,
    frontendRpcsMissing: frontendRpcs.length,
  },
  liveFunctions: liveFns.sort(),
  liveTables: liveTables.sort(),
  missingTables,
  missingFunctions: missingFns,
  missingColumns: missingCols,
  frontendRpcsMissing: frontendRpcs,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(`Tables live: ${snapshot.counts.liveTables}, missing: ${snapshot.counts.missingTables}`);
  console.log(`RPCs live: ${snapshot.counts.liveFunctions}, missing from local: ${snapshot.counts.missingFunctions}`);
  console.log(`Columns missing: ${snapshot.counts.missingColumns}`);
  console.log(`Frontend RPCs missing: ${snapshot.counts.frontendRpcsMissing}`);
}

export default snapshot;
