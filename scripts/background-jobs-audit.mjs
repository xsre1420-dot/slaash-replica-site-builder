#!/usr/bin/env node
/**
 * Audits synchronous vs background-eligible operations across the codebase.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

const SYNC_PATTERNS = [
  /create_order_with_stock_deduction/,
  /patch_merchant_product/,
  /increment_product_stock/,
  /update_merchant_order_status/,
];

const ASYNC_PATTERNS = [
  /enqueue(Cache|Meta|Image|Analytics|Background)/,
  /enqueueJob\(/,
  /processQueueTick/,
  /void (invalidate|requestEdge|cleanup|deleteProduct|meta-conversions)/,
  /process_analytics_event_buffer/,
  /process_order_side_effects_batch/,
  /enqueue_product_import_job/,
];

const MUST_SYNC = [
  'createOrder',
  'updateOrderStatus',
  'createProduct',
  'applyStockQuantityPatch',
  'restockProduct',
  'checkout',
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (['node_modules', 'background'].includes(name)) continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

function classify(rel, text) {
  if (rel.startsWith('background/')) return 'BACKGROUND_INFRA';
  if (MUST_SYNC.some((s) => text.includes(s))) return 'MUST_SYNC';
  if (ASYNC_PATTERNS.some((r) => r.test(text))) return 'ALREADY_ASYNC';
  if (SYNC_PATTERNS.some((r) => r.test(text))) return 'MUST_SYNC';
  if (/void /.test(text) && /(invalidate|cleanup|purge|invoke)/.test(text)) return 'CAN_ASYNC';
  return 'OTHER';
}

const files = walk(SRC);
const rows = files
  .map((p) => {
    const rel = relative(SRC, p).replace(/\\/g, '/');
    const text = readFileSync(p, 'utf8');
    return { rel, kind: classify(rel, text) };
  })
  .filter((r) => r.kind !== 'OTHER');

const summary = rows.reduce((m, r) => {
  m[r.kind] = (m[r.kind] ?? 0) + 1;
  return m;
}, {});

console.log(JSON.stringify({ summary, rows: rows.slice(0, 80) }, null, 2));

const canAsync = rows.filter((r) => r.kind === 'CAN_ASYNC');
if (canAsync.length > 0) {
  console.warn(`\nRemaining CAN_ASYNC (raw void): ${canAsync.map((r) => r.rel).join(', ')}`);
}
