#!/usr/bin/env node
/**
 * Phase 1 — Complete SQL query inventory from src/ + edge functions.
 * Usage: node scripts/sql-query-inventory.mjs [--json]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

const FREQ = {
  get_storefront_page_bundle: { tier: 'critical', estPerSession: 1, path: 'storefront' },
  get_store_products_page: { tier: 'critical', estPerSession: 2, path: 'storefront' },
  track_store_visit_by_slug: { tier: 'high', estPerSession: 1, path: 'storefront' },
  get_store_meta: { tier: 'high', estPerSession: 2, path: 'storefront' },
  get_checkout_products_by_ids: { tier: 'critical', estPerSession: 1, path: 'checkout' },
  create_order_with_stock_deduction: { tier: 'critical', estPerSession: 0.05, path: 'checkout' },
  get_owner_products_page: { tier: 'high', estPerSession: 3, path: 'dashboard' },
  list_merchant_orders: { tier: 'high', estPerSession: 2, path: 'dashboard' },
  count_merchant_orders_by_workflow: { tier: 'medium', estPerSession: 1, path: 'dashboard' },
  get_dashboard_statistics_batch: { tier: 'high', estPerSession: 1, path: 'dashboard' },
  get_store_statistics: { tier: 'medium', estPerSession: 1, path: 'analytics' },
  get_statistics_page_bundle: { tier: 'medium', estPerSession: 1, path: 'analytics' },
  increment_product_stock: { tier: 'medium', estPerSession: 0.2, path: 'inventory' },
  get_merchant_product_by_id: { tier: 'medium', estPerSession: 2, path: 'dashboard' },
  platform_health_check: { tier: 'low', estPerSession: 0.01, path: 'ops' },
};

const TABLE_HINTS = {
  products: { joins: ['stores', 'categories'], filters: ['owner_id', 'archived_at', 'is_active'], sort: 'created_at DESC' },
  orders: { joins: ['order_items', 'order_refunds'], filters: ['owner_id', 'status', 'payment_status'], sort: 'created_at DESC' },
  order_items: { joins: ['orders', 'products'], filters: ['owner_id', 'order_id'], sort: 'created_at DESC' },
  store_visits: { joins: [], filters: ['owner_id', 'created_at'], sort: 'created_at DESC', pagination: 'append' },
  store_daily_stats: { joins: [], filters: ['owner_id', 'stat_date'], aggregations: 'SUM' },
  customers: { joins: [], filters: ['owner_id', 'phone'], sort: 'last_order_at DESC' },
  product_reviews: { joins: ['products'], filters: ['owner_id', 'is_approved'], sort: 'created_at DESC' },
  inventory_movements: { joins: ['products'], filters: ['owner_id', 'product_id'], sort: 'created_at DESC' },
  import_jobs: { joins: [], filters: ['owner_id', 'status'], sort: 'created_at DESC' },
  store_settings: { joins: ['stores'], filters: ['owner_id', 'store_slug'] },
  categories: { joins: [], filters: ['owner_id'], sort: 'display_order' },
};

const scanFiles = (patterns) => {
  const entries = [];
  for (const pattern of patterns) {
    for (const file of globSync(pattern, { ignore: ['**/node_modules/**', '**/*.test.*'] })) {
      const content = readFileSync(join(process.cwd(), file), 'utf8');
      const rel = file.replace(/\\/g, '/');

      for (const m of content.matchAll(/(?:\.rpc|callSupabaseRpc)\(\s*['"`](\w+)['"`]/g)) {
        entries.push({ kind: 'rpc', name: m[1], file: rel, count: 1 });
      }
      for (const m of content.matchAll(/\.from\(\s*['"`](\w+)['"`]/g)) {
        entries.push({ kind: 'table', name: m[1], file: rel, count: 1 });
      }
    }
  }
  return entries;
};

const aggregate = (entries) => {
  const map = new Map();
  for (const e of entries) {
    const key = `${e.kind}:${e.name}`;
    const prev = map.get(key) ?? { ...e, files: new Set(), callSites: 0 };
    prev.files.add(e.file);
    prev.callSites += 1;
    map.set(key, prev);
  }
  return [...map.values()].map((x) => ({
    kind: x.kind,
    name: x.name,
    callSites: x.callSites,
    files: [...x.files].sort(),
    ...(x.kind === 'rpc' ? FREQ[x.name] ?? { tier: 'unknown', estPerSession: 0, path: 'misc' } : {}),
    ...(x.kind === 'table' ? TABLE_HINTS[x.name] ?? {} : {}),
  }));
};

const entries = scanFiles(['src/**/*.{ts,tsx}', 'supabase/functions/**/*.ts']);
const inventory = aggregate(entries).sort((a, b) => {
  const tierOrder = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
  const ta = tierOrder[a.tier ?? 'unknown'];
  const tb = tierOrder[b.tier ?? 'unknown'];
  if (ta !== tb) return ta - tb;
  return b.callSites - a.callSites;
});

const summary = {
  generatedAt: new Date().toISOString(),
  rpcCount: inventory.filter((x) => x.kind === 'rpc').length,
  tableCount: inventory.filter((x) => x.kind === 'table').length,
  totalCallSites: inventory.reduce((s, x) => s + x.callSites, 0),
  criticalRpcs: inventory.filter((x) => x.kind === 'rpc' && x.tier === 'critical').map((x) => x.name),
  highRpcs: inventory.filter((x) => x.kind === 'rpc' && x.tier === 'high').map((x) => x.name),
};

const outJson = join(process.cwd(), 'supabase/SQL_QUERY_INVENTORY.json');
const outMd = join(process.cwd(), 'supabase/SQL_QUERY_INVENTORY.md');

writeFileSync(outJson, JSON.stringify({ summary, inventory }, null, 2));

const md = [
  '# SQL Query Inventory — Phase 1',
  '',
  `Generated: ${summary.generatedAt}`,
  '',
  '## Summary',
  '',
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Unique RPCs | ${summary.rpcCount} |`,
  `| Unique tables (PostgREST) | ${summary.tableCount} |`,
  `| Total call sites | ${summary.totalCallSites} |`,
  `| Critical-path RPCs | ${summary.criticalRpcs.join(', ') || '—'} |`,
  '',
  '## RPC Inventory (by priority)',
  '',
  '| RPC | Tier | Est/session | Domain | Call sites | Locations |',
  '|-----|------|-------------|--------|------------|-----------|',
  ...inventory
    .filter((x) => x.kind === 'rpc')
    .map(
      (x) =>
        `| ${x.name} | ${x.tier ?? '—'} | ${x.estPerSession ?? '—'} | ${x.path ?? '—'} | ${x.callSites} | ${x.files.slice(0, 3).join(', ')}${x.files.length > 3 ? '…' : ''} |`
    ),
  '',
  '## PostgREST Table Access',
  '',
  '| Table | Call sites | Key filters / joins |',
  '|-------|------------|---------------------|',
  ...inventory
    .filter((x) => x.kind === 'table')
    .map((x) => {
      const filters = x.filters?.join(', ') ?? '—';
      const joins = x.joins?.join(', ') ?? '—';
      return `| ${x.name} | ${x.callSites} | filters: ${filters}; joins: ${joins} |`;
    }),
  '',
];

writeFileSync(outMd, md.join('\n'));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, inventory }, null, 2));
} else {
  console.log(`✓ Inventory: ${summary.rpcCount} RPCs, ${summary.tableCount} tables, ${summary.totalCallSites} call sites`);
  console.log(`  → ${outJson}`);
  console.log(`  → ${outMd}`);
}
