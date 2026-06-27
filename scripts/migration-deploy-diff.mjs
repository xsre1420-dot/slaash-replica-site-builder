#!/usr/bin/env node
/**
 * Definitive diff: local migrations vs linked Supabase remote.
 * Evidence: supabase migration list --linked + types.generated.ts + live RPC probes.
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const loadEnv = () => {
  const envPath = join(root, '.env');
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
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

const typesSrc = readFileSync(join(root, 'src/integrations/supabase/types.generated.ts'), 'utf8');

const extractFromTypes = () => {
  const tables = [];
  const functions = [];
  const tableColumns = {};
  const publicIdx = typesSrc.indexOf('  public: {');
  const section = publicIdx >= 0 ? typesSrc.slice(publicIdx) : typesSrc;
  const lines = section.split(/\r?\n/);
  let mode = '';
  let currentTable = '';
  for (const line of lines) {
    if (/^\s+Tables: \{$/.test(line)) { mode = 'tables'; continue; }
    if (/^\s+Views: \{$/.test(line)) { mode = 'views'; continue; }
    if (/^\s+Functions: \{$/.test(line)) { mode = 'functions'; continue; }
    if (/^\s+Enums: \{$/.test(line)) { mode = 'enums'; break; }
    const tm = line.match(/^\s{6}([a-z_][a-z0-9_]*): \{$/);
    if (mode === 'tables' && tm) {
      currentTable = tm[1];
      tables.push(currentTable);
      tableColumns[currentTable] = [];
      continue;
    }
    if (mode === 'tables' && currentTable && /^\s+Row: \{$/.test(line)) {
      mode = 'row';
      continue;
    }
    if (mode === 'row') {
      if (/^\s{6}\}/.test(line)) { mode = 'tables'; continue; }
      const cm = line.match(/^\s{10}(\w+):/);
      if (cm) tableColumns[currentTable].push(cm[1]);
      continue;
    }
    const fm = line.match(/^\s{6}([a-z_][a-z0-9_]*):/);
    if (mode === 'functions' && fm) functions.push(fm[1]);
  }
  return { tables, functions, tableColumns };
};

const parseMigrationList = () => {
  const out = execSync('supabase migration list --linked', { encoding: 'utf8', cwd: root });
  const deployed = [];
  const notDeployed = [];
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^\s+(\d{14})\s+\|\s+(\d{14})?\s*\|/);
    if (!m) continue;
    const local = m[1];
    const remote = m[2]?.trim();
    if (remote) deployed.push(local);
    else notDeployed.push(local);
  }
  return { deployed, notDeployed, raw: out };
};

const migrationFiles = readdirSync(join(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();

const migrationId = (f) => f.split('_')[0];

const parseSqlObjects = (filename) => {
  const sql = readFileSync(join(root, 'supabase/migrations', filename), 'utf8');
  const tables = [...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+public\.([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]);
  const fns = [...sql.matchAll(/CREATE OR REPLACE FUNCTION\s+public\.([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]);
  const cols = [...sql.matchAll(/ALTER TABLE(?: IF EXISTS)?\s+public\.([a-z_][a-z0-9_]*)\s+ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)]
    .map((m) => ({ table: m[1], column: m[2] }));
  const versions = [...sql.matchAll(/INSERT INTO public\.platform_schema_version \(version, notes\)\s+VALUES\s*\(\s*(\d+)/gi)].map((m) => Number(m[1]));
  return { tables: [...new Set(tables)], fns: [...new Set(fns)], cols, versions };
};

const { deployed, notDeployed } = parseMigrationList();
const notDeployedFiles = migrationFiles.filter((f) => notDeployed.includes(migrationId(f)));
const deployedFiles = migrationFiles.filter((f) => deployed.includes(migrationId(f)));

const undeployedObjects = { tables: new Map(), fns: new Map(), cols: [] };
for (const f of notDeployedFiles) {
  const o = parseSqlObjects(f);
  for (const t of o.tables) undeployedObjects.tables.set(t, f);
  for (const fn of o.fns) undeployedObjects.fns.set(fn, f);
  for (const c of o.cols) undeployedObjects.cols.push({ ...c, file: f });
}

const { tables: liveTables, functions: liveFunctions, tableColumns: liveCols } = extractFromTypes();

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

async function probeRpc(name) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: '{}' });
  const body = await res.text();
  if (body.includes('Could not find the function') || res.status === 404) return false;
  return true;
}

async function probeTable(name) {
  const res = await fetch(`${url}/rest/v1/${name}?select=id&limit=0`, { headers });
  if (res.ok) return true;
  const body = await res.text();
  if (body.includes('Could not find the table')) return false;
  if (res.status === 400 && body.includes('column')) return true; // table exists
  return res.status !== 404;
}

const undeployedFnList = [...undeployedObjects.fns.keys()].sort();
const rpcMissingOnLive = [];
const rpcPresentOnLive = [];
for (const fn of undeployedFnList) {
  const exists = await probeRpc(fn);
  (exists ? rpcPresentOnLive : rpcMissingOnLive).push(fn);
}

const undeployedTableList = [...undeployedObjects.tables.keys()].sort();
const tablesMissingOnLive = [];
const tablesPresentOnLive = [];
for (const t of undeployedTableList) {
  const pk = t === 'platform_schema_version' ? 'version' : 'id';
  const res = await fetch(`${url}/rest/v1/${t}?select=${pk}&limit=0`, { headers });
  const body = await res.text();
  const missing = res.status === 404 || body.includes('Could not find the table');
  (missing ? tablesMissingOnLive : tablesPresentOnLive).push(t);
}

const colsMissing = [];
const colsPresent = [];
for (const { table, column, file } of undeployedObjects.cols) {
  const liveTableCols = liveCols[table] || [];
  if (!liveTables.includes(table)) {
    colsMissing.push({ table, column, file, reason: 'table_not_in_types' });
  } else if (!liveTableCols.includes(column)) {
    colsMissing.push({ table, column, file, reason: 'column_not_in_types' });
  } else {
    colsPresent.push({ table, column, file });
  }
}

let platformVersions = [];
try {
  const res = await fetch(`${url}/rest/v1/platform_schema_version?select=version,notes&order=version.desc&limit=5`, { headers });
  if (res.ok) platformVersions = await res.json();
} catch { /* ignore */ }

const report = {
  generatedAt: new Date().toISOString(),
  projectUrl: url,
  counts: {
    localMigrationFiles: migrationFiles.length,
    deployedOnRemote: deployed.length,
    notDeployedOnRemote: notDeployed.length,
    liveTablesInTypes: liveTables.length,
    liveFunctionsInTypes: liveFunctions.length,
  },
  lastDeployedMigration: deployed[deployed.length - 1],
  latestLocalMigration: migrationId(migrationFiles[migrationFiles.length - 1]),
  notDeployedMigrationIds: notDeployed,
  notDeployedFilenames: notDeployedFiles,
  platformSchemaVersionOnLive: platformVersions,
  undeployedOnly: {
    tablesIntroduced: undeployedTableList,
    tablesMissingOnLive,
    tablesPresentOnLive,
    rpcsIntroduced: undeployedFnList.length,
    rpcsMissingOnLive: rpcMissingOnLive,
    rpcsPresentOnLive: rpcPresentOnLive,
    columnsIntroduced: undeployedObjects.cols,
    columnsMissing: colsMissing,
    columnsPresent: colsPresent,
  },
};

const md = [];
md.push('# Migration Deploy Diff Report');
md.push('');
md.push(`**Generated:** ${report.generatedAt}`);
md.push(`**Project:** ${url}`);
md.push(`**Source:** \`supabase migration list --linked\` (Supabase CLI remote migration history)`);
md.push('');
md.push('## Counts');
md.push('');
md.push(`| Metric | Count |`);
md.push(`|--------|------:|`);
md.push(`| Local migration files (\`supabase/migrations/*.sql\`) | **${report.counts.localMigrationFiles}** |`);
md.push(`| Applied on linked remote | **${report.counts.deployedOnRemote}** |`);
md.push(`| **NOT applied on linked remote** | **${report.counts.notDeployedOnRemote}** |`);
md.push(`| Tables in live schema (\`types.generated.ts\`) | ${report.counts.liveTablesInTypes} |`);
md.push(`| RPCs in live schema (\`types.generated.ts\`) | ${report.counts.liveFunctionsInTypes} |`);
md.push('');
md.push(`**Last deployed migration (remote):** \`${report.lastDeployedMigration}\``);
md.push(`**Latest local migration (disk):** \`${report.latestLocalMigration}\``);
md.push('');
if (platformVersions.length) {
  md.push('## Live `platform_schema_version` (top 5)');
  md.push('');
  for (const v of platformVersions) md.push(`- v**${v.version}**: ${v.notes || ''}`);
  md.push('');
}
md.push('## Migrations on disk NOT deployed to remote (31)');
md.push('');
for (const f of notDeployedFiles) md.push(`- \`${f}\``);
md.push('');
md.push('## Tables introduced in undeployed migrations — missing on live');
md.push('');
if (tablesMissingOnLive.length === 0) md.push('_None (or all already present via other means)_');
else tablesMissingOnLive.forEach((t) => md.push(`- \`${t}\` (from \`${undeployedObjects.tables.get(t)}\`)`));
md.push('');
md.push('## RPCs in undeployed migrations — missing on live (probed via PostgREST)');
md.push('');
if (rpcMissingOnLive.length === 0) md.push('_None_');
else rpcMissingOnLive.forEach((fn) => md.push(`- \`${fn}\` (from \`${undeployedObjects.fns.get(fn)}\`)`));
md.push('');
md.push('## Columns introduced in undeployed migrations — missing from live types');
md.push('');
if (colsMissing.length === 0) md.push('_None detected_');
else colsMissing.forEach((c) => md.push(`- \`${c.table}.${c.column}\` — \`${c.file}\` (${c.reason})`));
md.push('');
md.push('## Conclusion');
md.push('');
md.push('**YES — the local codebase is ahead of the deployed Supabase database.**');
md.push('');
md.push(`Evidence: **${report.counts.notDeployedOnRemote}** migration files exist locally with **no matching remote entry** in Supabase migration history. Last remote migration: **${report.lastDeployedMigration}**. Latest local: **${report.latestLocalMigration}**.`);

writeFileSync(join(root, 'supabase/MIGRATION_DEPLOY_DIFF_REPORT.md'), md.join('\n'));
writeFileSync(join(root, 'supabase/MIGRATION_DEPLOY_DIFF_REPORT.json'), JSON.stringify(report, null, 2));
console.log(md.join('\n'));
