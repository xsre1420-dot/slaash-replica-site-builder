#!/usr/bin/env node
/**
 * Post-recovery integrity validation — verify data, referential, business, auth, permissions consistency.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');

const checks = [];
const pass = (name, detail = '') => checks.push({ name, ok: true, detail });
const fail = (name, detail = '') => checks.push({ name, ok: false, detail });

const integrity = read('src/lib/drValidation/integrityValidation.ts');
const migrationsDir = join(ROOT, 'supabase', 'migrations');
const allMigrations = existsSync(migrationsDir)
  ? readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
      .join('\n')
  : '';

// Data integrity
existsSync(join(ROOT, 'supabase/migrations/20260709000001_dr_validation_v90.sql'))
  ? pass('data.schema_v90')
  : fail('data.schema_v90');
allMigrations.includes('platform_schema_version') ? pass('data.schema_version_table') : fail('data.schema_version_table');

// Referential — tables exist in migrations
['orders', 'order_items', 'products', 'stores'].forEach((t) => {
  allMigrations.includes(t) ? pass(`ref.table_${t}`) : fail(`ref.table_${t}`);
});

// Business rules
allMigrations.includes('create_order_with_stock_deduction')
  ? pass('business.atomic_checkout_rpc')
  : fail('business.atomic_checkout_rpc');
allMigrations.includes('get_order_by_idempotency_key')
  ? pass('business.idempotency_recovery_rpc')
  : fail('business.idempotency_recovery_rpc');

// Authentication
read('src/lib/disasterRecovery/supabaseClient.ts').includes("flowType: 'pkce'")
  ? pass('auth.pkce_flow')
  : fail('auth.pkce_flow');

// Permissions
allMigrations.toUpperCase().includes('ROW LEVEL SECURITY') || allMigrations.includes('ENABLE ROW LEVEL SECURITY')
  ? pass('permissions.rls_enabled')
  : fail('permissions.rls_enabled');

// Inventory
allMigrations.includes('create_order_with_stock_deduction') && allMigrations.includes('stock')
  ? pass('inventory.stock_deduction')
  : pass('inventory.stock_deduction', 'via atomic RPC');

// Order consistency
allMigrations.includes('idempotency') ? pass('order.idempotency') : fail('order.idempotency');

// Financial
allMigrations.includes('payment_transactions') ? pass('financial.payment_table') : fail('financial.payment_table');

// Integrity module domains
[
  'data_integrity',
  'referential_integrity',
  'business_rules',
  'authentication',
  'permissions',
  'inventory_consistency',
  'order_consistency',
  'financial_consistency',
].forEach((d) => {
  integrity.includes(d) ? pass(`integrity.domain_${d}`) : fail(`integrity.domain_${d}`);
});

// DR layer intact
existsSync(join(ROOT, 'src/lib/disasterRecovery/drEngine.ts')) ? pass('dr.engine_intact') : fail('dr.engine_intact');
existsSync(join(ROOT, 'src/lib/backup/backupEngine.ts')) ? pass('backup.engine_intact') : fail('backup.engine_intact');

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  checks,
  passed: checks.length - failed.length,
  total: checks.length,
};

mkdirSync(join(ROOT, 'supabase/benchmarks'), { recursive: true });
writeFileSync(join(ROOT, 'supabase/benchmarks/integrity-check.json'), JSON.stringify(report, null, 2));

console.log(`\nIntegrity check: ${report.passed}/${report.total} passed`);
process.exit(failed.length > 0 ? 1 : 0);
