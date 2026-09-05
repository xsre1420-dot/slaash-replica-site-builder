#!/usr/bin/env node
/**
 * Compare app-critical RPCs/tables against linked production via supabase db query.
 * Usage: node scripts/production-schema-audit.mjs [--use-cli]
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const CRITICAL_RPCS = [
  'create_order_with_stock_deduction',
  'get_checkout_preflight_bundle',
  'get_dashboard_statistics_batch',
  'get_dashboard_kpis_light',
  'get_dashboard_workflow_counts',
  'get_store_statistics',
  'get_statistics_page_bundle',
  'get_merchant_inventory_page_bundle',
  'merchant_inventory_summary',
  'get_storefront_page_bundle',
  'get_store_products_page',
  'process_order_side_effects_batch',
  'side_effects_outbox_backlog_health',
  'process_webhook_outbox_worker_start',
  'process_background_worker_bundle',
  'platform_monitoring_observability_audit',
  'platform_health_check',
  'get_background_jobs_status',
  'ensure_default_warehouse',
  'increment_product_stock',
];

const CRITICAL_TABLES = [
  'orders',
  'products',
  'order_side_effects_outbox',
  'warehouses',
  'warehouse_stock',
  'purchase_orders',
  'suppliers',
];

function cliQuery(sql) {
  const result = spawnSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'supabase db query failed');
  }
  return JSON.parse(result.stdout);
}

async function main() {
  const rpcList = CRITICAL_RPCS.map((n) => `'${n}'`).join(',');
  const rpcSql = `
    SELECT p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (${rpcList})
    ORDER BY p.proname, args;
  `;

  const tableList = CRITICAL_TABLES.map((t) => `'${t}'`).join(',');
  const tableSql = `
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN (${tableList})
    ORDER BY tablename;
  `;

  const schemaSql = `SELECT max(version)::int AS schema_version FROM public.platform_schema_version;`;

  console.log('Production schema audit — critical objects\n');

  try {
    const rpcOut = cliQuery(rpcSql);
    const foundRpcs = new Set((rpcOut.rows ?? []).map((r) => r.name));
    console.log('=== RPCs ===');
    for (const rpc of CRITICAL_RPCS) {
      const status = foundRpcs.has(rpc) ? 'PRESENT' : 'MISSING';
      console.log(`${status.padEnd(8)} ${rpc}`);
    }

    const tableOut = cliQuery(tableSql);
    const foundTables = new Set((tableOut.rows ?? []).map((r) => r.tablename));
    console.log('\n=== Tables ===');
    for (const t of CRITICAL_TABLES) {
      const status = foundTables.has(t) ? 'PRESENT' : 'MISSING';
      console.log(`${status.padEnd(8)} ${t}`);
    }

    const schemaOut = cliQuery(schemaSql);
    console.log('\n=== Schema version ===', schemaOut.rows?.[0]?.schema_version ?? 'unknown');
  } catch (err) {
    console.error('Audit failed:', err.message || err);
    process.exit(1);
  }
}

main();
