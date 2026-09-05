#!/usr/bin/env node
/**
 * Function drift audit — compare app-critical RPCs against live production.
 * Usage: node scripts/function-drift-audit.mjs [--json]
 */
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
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
const jsonOut = process.argv.includes('--json');

/** Canonical production RPCs — must match rpcRegistry.ts REQUIRED + shipped optional */
const CANONICAL = {
  required: [
    'create_order_with_stock_deduction',
    'checkout_lock_product_snapshots',
    'get_checkout_preflight_bundle',
    'get_order_by_idempotency_key',
    'increment_product_stock',
    'merchant_inventory_summary',
    'batch_restock_products',
    'list_merchant_inventory_movements',
    'audit_merchant_inventory_integrity',
    'get_storefront_page_bundle',
    'get_store_products_page',
    'track_store_visit_by_slug',
    'track_product_view_by_slug',
    'get_dashboard_statistics_batch',
    'get_store_statistics',
    'list_merchant_orders',
    'update_merchant_order_status',
    'process_order_side_effects_batch',
    'side_effects_outbox_backlog_health',
  ],
  optional: [
    'get_dashboard_kpis_light',
    'get_dashboard_workflow_counts',
    'get_statistics_page_bundle',
    'flush_merchant_analytics_buffer',
    'process_webhook_outbox_worker_start',
    'platform_monitoring_observability_audit',
    'platform_queue_health_audit',
    'retry_analytics_dead_letter',
    'retry_side_effects_dead_letter',
    'recover_stale_import_jobs',
    'get_background_jobs_status',
    'get_merchant_inventory_page_bundle',
  ],
  obsolete: [
    { name: 'create_order_with_stock_deduction', args: '9-param without idempotency' },
    { name: 'create_order_with_stock_deduction', args: '11-param without coupon' },
    { name: 'create_order_with_stock_deduction', args: '12-param without p_store_slug' },
    { name: 'increment_product_stock', args: '4-param without p_min_stock_level' },
    { name: 'get_store_statistics', args: 'days overload (uuid, int)' },
  ],
};

const OBSOLETE_DROP_SIGNATURES = [
  ['create_order_with_stock_deduction', 'uuid, uuid, text, text, text, numeric, text, text, jsonb'],
  ['create_order_with_stock_deduction', 'uuid, uuid, text, text, text, text, numeric, text, text, jsonb, text'],
  ['create_order_with_stock_deduction', 'uuid, uuid, text, text, text, text, numeric, text, text, jsonb, text, text'],
  ['increment_product_stock', 'uuid, uuid, integer, text'],
  ['get_store_statistics', 'uuid, integer'],
];

function scanAppRpcCalls() {
  const files = globSync('{src,supabase/functions}/**/*.{ts,tsx}', {
    ignore: ['**/*.test.*', '**/types.generated.ts'],
  });
  const calls = new Map();
  for (const file of files) {
    const content = readFileSync(join(process.cwd(), file), 'utf8');
    for (const m of content.matchAll(/(?:callReadRpc|callWriteRpc|callSupabaseRpc|\.rpc)\s*(?:<[^>]*>)?\(\s*['"`](\w+)['"`]/g)) {
      const name = m[1];
      if (!calls.has(name)) calls.set(name, []);
      calls.get(name).push(file.replace(/\\/g, '/'));
    }
  }
  return calls;
}

function cliQuery(sql) {
  const result = spawnSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

async function probeRpcPostgrest(name) {
  if (!url || !key) return { exists: false, error: 'missing env' };
  const probeOwner = '00000000-0000-0000-0000-000000000000';
  const argsByFn = {
    create_order_with_stock_deduction: {
      p_order_id: probeOwner,
      p_owner_id: probeOwner,
      p_idempotency_key: 'probe',
      p_customer_name: 'probe',
      p_customer_phone: '000',
      p_customer_address: 'probe',
      p_total_amount: 0,
      p_customer_governorate: null,
      p_notes: null,
      p_items: [],
      p_payment_method: 'cash_on_delivery',
      p_coupon_code: null,
      p_store_slug: 'probe',
    },
    checkout_lock_product_snapshots: { p_owner_id: probeOwner, p_items: [] },
    get_checkout_preflight_bundle: { p_slug: 'probe', p_product_ids: [] },
    get_order_by_idempotency_key: { p_idempotency_key: 'probe', p_owner_id: probeOwner },
    increment_product_stock: { p_product_id: probeOwner, p_owner_id: probeOwner, p_delta: 0, p_min_stock_level: 1 },
    merchant_inventory_summary: { p_owner_id: probeOwner },
    batch_restock_products: { p_owner_id: probeOwner, p_items: [] },
    list_merchant_inventory_movements: { p_owner_id: probeOwner, p_limit: 1 },
    audit_merchant_inventory_integrity: { p_owner_id: probeOwner },
    get_storefront_page_bundle: { p_slug: 'probe', p_limit: 1, p_cursor: '', p_category: '', p_search: '' },
    get_store_products_page: { p_slug: 'probe', p_limit: 1, p_cursor: '', p_category: '', p_search: '' },
    track_store_visit_by_slug: { p_store_slug: 'probe', p_page_path: '/' },
    track_product_view_by_slug: { p_slug: 'probe', p_product_id: probeOwner },
    get_dashboard_statistics_batch: { p_owner_id: probeOwner },
    get_store_statistics: {
      p_owner_id: probeOwner,
      p_start: '2000-01-01T00:00:00Z',
      p_end: '2000-01-02T00:00:00Z',
    },
    list_merchant_orders: { p_owner_id: probeOwner, p_page: 1, p_page_size: 1 },
    update_merchant_order_status: { p_order_id: probeOwner, p_owner_id: probeOwner, p_status: 'pending' },
    process_order_side_effects_batch: { p_limit: 1 },
    side_effects_outbox_backlog_health: {},
    get_dashboard_kpis_light: { p_owner_id: probeOwner },
    get_dashboard_workflow_counts: { p_owner_id: probeOwner },
    get_statistics_page_bundle: {
      p_owner_id: probeOwner,
      p_current_start: '2000-01-01T00:00:00Z',
      p_current_end: '2000-01-02T00:00:00Z',
      p_previous_start: '1999-12-01T00:00:00Z',
      p_previous_end: '1999-12-31T00:00:00Z',
    },
    flush_merchant_analytics_buffer: { p_limit: 1 },
    process_webhook_outbox_worker_start: { p_limit: 1 },
    platform_monitoring_observability_audit: {},
    get_merchant_inventory_page_bundle: { p_owner_id: probeOwner, p_limit: 1 },
  };
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(argsByFn[name] ?? {}),
  });
  const text = await res.text();
  if (text.includes('Could not find the function') || res.status === 404) {
    return { exists: false, status: res.status };
  }
  return { exists: true, status: res.status };
}

async function main() {
  const appCalls = scanAppRpcCalls();
  const report = {
    auditedAt: new Date().toISOString(),
    production: {},
    appCallsWithoutGuard: [],
    missingRequired: [],
    missingOptional: [],
    obsoleteStillPresent: [],
    ok: true,
  };

  // Production introspection via CLI when available
  let prodFunctions = [];
  const fnSql = `
    SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname, args;
  `;
  const cliResult = cliQuery(fnSql);
  if (cliResult?.rows) {
    prodFunctions = cliResult.rows;
    report.production.source = 'supabase_cli';
  } else if (url && key) {
    report.production.source = 'postgrest_probe';
    for (const rpc of [...CANONICAL.required, ...CANONICAL.optional]) {
      const probe = await probeRpcPostgrest(rpc);
      report.production[rpc] = probe.exists ? 'present' : 'missing';
    }
  } else {
    report.production.source = 'skipped';
  }

  const fnByName = new Map();
  for (const row of prodFunctions) {
    const list = fnByName.get(row.name) ?? [];
    list.push(row.args);
    fnByName.set(row.name, list);
  }

  for (const rpc of CANONICAL.required) {
    const present = prodFunctions.length
      ? fnByName.has(rpc)
      : report.production[rpc] === 'present';
    if (!present) {
      report.missingRequired.push(rpc);
      report.ok = false;
    }
  }

  for (const rpc of CANONICAL.optional) {
    const present = prodFunctions.length
      ? fnByName.has(rpc)
      : report.production[rpc] === 'present';
    if (!present) report.missingOptional.push(rpc);
  }

  for (const [name, sigPattern] of OBSOLETE_DROP_SIGNATURES) {
    const overloads = fnByName.get(name) ?? [];
    const hit = overloads.some((args) => args.replace(/\s/g, '') === sigPattern.replace(/\s/g, ''));
    if (hit) {
      report.obsoleteStillPresent.push({ name, signature: sigPattern });
      report.ok = false;
    }
  }

  // Checkout must have exactly one create_order overload in production
  const checkoutOverloads = fnByName.get('create_order_with_stock_deduction') ?? [];
  if (checkoutOverloads.length > 1) {
    report.obsoleteStillPresent.push({
      name: 'create_order_with_stock_deduction',
      signature: `multiple overloads: ${checkoutOverloads.join(' | ')}`,
    });
    report.ok = false;
  }

  // Deferred RPCs called without capability guard
  const DEFERRED = new Set([
    'get_merchant_inventory_page_bundle',
    'ensure_default_warehouse',
    'merchant_inventory_forecast',
    'merchant_abc_analysis',
    'lookup_product_by_barcode',
    'transfer_warehouse_stock',
    'platform_monitoring_observability_audit',
  ]);
  const GUARD_FILES = [
    'schemaCapabilities',
    'inventoryPageService',
    'inventoryReadService',
    'inventoryWriteService',
    'serverMetricsProbe',
    'process-order-webhook-outbox',
  ];
  for (const rpc of DEFERRED) {
    const sites = appCalls.get(rpc) ?? [];
    const unguarded = sites.filter(
      (f) => !GUARD_FILES.some((g) => f.includes(g)) && !f.includes('inventoryRepository.ts')
    );
    if (unguarded.length) {
      report.appCallsWithoutGuard.push({ rpc, files: unguarded });
    }
  }

  if (jsonOut) {
    const outPath = join(process.cwd(), 'supabase/benchmarks/function-drift-audit.json');
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Wrote ${outPath}`);
  } else {
    console.log('=== Function Drift Audit ===\n');
    console.log(`Production source: ${report.production.source}`);
    if (report.missingRequired.length) {
      console.log('\nMISSING REQUIRED:');
      report.missingRequired.forEach((r) => console.log(`  ✗ ${r}`));
    } else {
      console.log('\n✓ All required RPCs present');
    }
    if (report.missingOptional.length) {
      console.log('\nMissing optional (fallbacks active):');
      report.missingOptional.forEach((r) => console.log(`  ? ${r}`));
    }
    if (report.obsoleteStillPresent.length) {
      console.log('\nOBSOLETE OVERLOADS STILL IN PRODUCTION:');
      report.obsoleteStillPresent.forEach((r) => console.log(`  ✗ ${r.name} (${r.signature})`));
    }
    if (report.appCallsWithoutGuard.length) {
      console.log('\nDeferred RPC calls without capability guard:');
      report.appCallsWithoutGuard.forEach(({ rpc, files }) =>
        console.log(`  ! ${rpc}: ${files.join(', ')}`)
      );
    }
    console.log(`\nOverall: ${report.ok ? 'PASS' : 'FAIL'}`);
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
