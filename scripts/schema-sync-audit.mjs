#!/usr/bin/env node
/**
 * Full schema sync audit: types.generated.ts vs src/ usage vs live Supabase (read-only).
 * Usage: node scripts/schema-sync-audit.mjs [--json]
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

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
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

const typesPath = join(process.cwd(), 'src/integrations/supabase/types.generated.ts');
const typesSrc = readFileSync(typesPath, 'utf8');

const publicSection = (() => {
  const idx = typesSrc.indexOf('  public: {');
  return idx >= 0 ? typesSrc.slice(idx) : typesSrc;
})();
const lines = publicSection.split(/\r?\n/);

const extractTables = () => {
  const tables = [];
  let inTables = false;
  for (const line of lines) {
    if (/^\s+Tables: \{$/.test(line)) {
      inTables = true;
      continue;
    }
    if (inTables && /^\s+Views: \{$/.test(line)) break;
    const m = line.match(/^\s{6}([a-z_][a-z0-9_]*): \{$/);
    if (inTables && m) tables.push(m[1]);
  }
  return tables;
};

const extractFunctions = () => {
  const fns = [];
  let inFunctions = false;
  let seenViews = false;
  for (const line of lines) {
    if (/^\s+Views: \{$/.test(line)) seenViews = true;
    if (seenViews && /^\s+Functions: \{$/.test(line)) {
      inFunctions = true;
      continue;
    }
    if (inFunctions && /^\s+Enums: \{$/.test(line)) break;
    const m = line.match(/^\s{6}([a-z_][a-z0-9_]*):/);
    if (inFunctions && m) fns.push(m[1]);
  }
  return fns;
};

const extractTableColumns = (table) => {
  const re = new RegExp(`${table}:\\s*\\{[\\s\\S]*?Row:\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const m = typesSrc.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/^\s{10}(\w+):/gm)].map((x) => x[1]);
};

const scanSrc = () => {
  const files = globSync('src/**/*.{ts,tsx}', { ignore: ['**/*.test.*', '**/types.generated.ts'] });
  const rpcs = new Set();
  const tables = new Set();
  const selects = [];

  for (const file of files) {
    const content = readFileSync(join(process.cwd(), file), 'utf8');
    for (const m of content.matchAll(/\.rpc\(\s*['"`](\w+)['"`]/g)) rpcs.add(m[1]);
    for (const m of content.matchAll(/\.from\(\s*['"`](\w+)['"`]/g)) tables.add(m[1]);
    for (const m of content.matchAll(/\.select\(\s*['"`]([^'"`]+)['"`]/g)) {
      selects.push({ file, cols: m[1] });
    }
  }
  return { rpcs: [...rpcs].sort(), tables: [...tables].sort(), selects };
};

const KNOWN_COLUMN_ALIASES = {
  store_settings: ['custom_domain', 'domain_verified'],
};

const auditSelectColumns = (tables, selects) => {
  const issues = [];
  for (const { file, cols } of selects) {
    if (cols === '*' || cols.includes('(')) continue;
    const colList = cols.split(',').map((c) => c.trim().split(/\s+/)[0]);
    for (const col of colList) {
      for (const [table, tableCols] of Object.entries(tables)) {
        if (!file.toLowerCase().includes(table.slice(0, 5))) continue;
      }
    }
    // Cross-check store_settings / products columns mentioned in select strings
    if (/custom_domain|domain_verified/.test(cols)) {
      const ssCols = extractTableColumns('store_settings');
      for (const col of ['custom_domain', 'domain_verified']) {
        if (cols.includes(col) && !ssCols.includes(col)) {
          issues.push({ type: 'missing_column', table: 'store_settings', column: col, file, select: cols });
        }
      }
    }
  }
  return issues;
};

async function probeLive(tables, rpcs) {
  if (!url || !key) return { skipped: true, reason: 'missing env keys' };

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const tableStatus = {};
  for (const t of tables) {
    const pk = t === 'platform_schema_version' ? 'version' : 'id';
    const res = await fetch(`${url}/rest/v1/${t}?select=${pk}&limit=0`, { headers });
    tableStatus[t] = { ok: res.ok, status: res.status };
  }

  let health = null;
  const hres = await fetch(`${url}/rest/v1/rpc/platform_health_check`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (hres.ok) {
    health = await hres.json();
  } else {
    health = { error: await hres.text(), status: hres.status };
  }

  const rpcStatus = {};
  const rpcArgs = {
    get_store_meta: { p_slug: 'health-probe-invalid' },
    get_store_products_page: { p_slug: 'health-probe-invalid', p_limit: 1, p_cursor: '', p_category: '', p_search: '' },
    is_username_available: { p_username: 'health_probe_user' },
    platform_health_check: {},
  };

  for (const fn of rpcs.slice(0, 20)) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rpcArgs[fn] || {}),
    });
    const body = await res.text();
    rpcStatus[fn] = {
      callable: !body.includes('Could not find the function'),
      status: res.status,
    };
  }

  return { tableStatus, health, rpcStatus, skipped: false };
}

const dbTables = extractTables();
const dbFunctions = extractFunctions();
const usage = scanSrc();

const rpcMissingInTypes = usage.rpcs.filter((r) => !dbFunctions.includes(r));
const rpcInTypesNotUsed = dbFunctions.filter(
  (f) => !f.startsWith('_') && !usage.rpcs.includes(f) && !f.startsWith('adjust_') && !f.startsWith('effective_')
);
const tableMissingInTypes = usage.tables.filter((t) => !dbTables.includes(t));
const columnIssues = auditSelectColumns({}, usage.selects);

const report = {
  generatedAt: new Date().toISOString(),
  projectUrl: url || null,
  schema: {
    tablesInDb: dbTables.length,
    functionsInDb: dbFunctions.length,
    migrationsOnDisk: globSync('supabase/migrations/*.sql').length,
    latestMigration: globSync('supabase/migrations/*.sql').sort().pop()?.split(/[/\\]/).pop(),
    platformSchemaVersion: dbTables.includes('platform_schema_version'),
  },
  frontend: {
    rpcCalls: usage.rpcs.length,
    tableQueries: usage.tables.length,
  },
  drift: {
    rpcMissingInTypes,
    tableMissingInTypes,
    columnIssues,
    rpcInTypesNotUsedCount: rpcInTypesNotUsed.length,
    rpcInTypesNotUsedSample: rpcInTypesNotUsed.slice(0, 15),
  },
  live: null,
};

report.live = await probeLive(
  ['store_settings', 'products', 'orders', 'leads', 'shipments', 'platform_schema_version'],
  ['platform_health_check', 'get_store_meta', 'get_store_products_page', 'create_order_with_stock_deduction', 'get_owner_bootstrap']
);

const outPath = join(process.cwd(), 'supabase/SCHEMA_SYNC_REPORT.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));

const reportLines = [
  '# Supabase Schema Synchronization Report',
  '',
  `Generated: ${report.generatedAt}`,
  `Project: ${url || 'N/A'}`,
  '',
  '## Summary',
  `- Tables in generated types: **${dbTables.length}**`,
  `- RPC functions in generated types: **${dbFunctions.length}**`,
  `- Migrations on disk: **${report.schema.migrationsOnDisk}** (latest: \`${report.schema.latestMigration}\`)`,
  `- Frontend RPC calls: **${usage.rpcs.length}**`,
  `- Frontend table queries: **${usage.tables.length}**`,
  '',
];

if (rpcMissingInTypes.length) {
  reportLines.push('## ❌ RPC used in frontend but missing from types', ...rpcMissingInTypes.map((r) => `- \`${r}\``), '');
} else {
  reportLines.push('## ✅ All frontend RPCs exist in generated types', '');
}

if (tableMissingInTypes.length) {
  reportLines.push('## ❌ Tables queried in frontend but missing from types', ...tableMissingInTypes.map((t) => `- \`${t}\``), '');
} else {
  reportLines.push('## ✅ All frontend table queries exist in generated types', '');
}

if (columnIssues.length) {
  reportLines.push('## ❌ Column drift (code vs types)', ...columnIssues.map((i) => `- \`${i.table}.${i.column}\` in \`${i.file}\``), '');
} else {
  reportLines.push('## ✅ No obvious column drift detected in audited selects', '');
}

if (report.live?.health?.message) {
  reportLines.push(
    '## Live health check',
    `- message: \`${report.live.health.message}\``,
    `- schema_version: **${report.live.health.schema_version}**`,
    `- required_version: **${report.live.health.required_version}**`,
    `- missing: ${(report.live.health.missing || []).length}`,
    ''
  );
}

writeFileSync(join(process.cwd(), 'supabase/SCHEMA_SYNC_REPORT.md'), reportLines.join('\n'));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(reportLines.join('\n'));
  console.log(`\nFull report: supabase/SCHEMA_SYNC_REPORT.md`);
}

process.exit(
  rpcMissingInTypes.length + tableMissingInTypes.length + columnIssues.length > 0 ? 1 : 0
);
