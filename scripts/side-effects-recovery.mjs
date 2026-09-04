#!/usr/bin/env node
/**
 * Phase 0.3 — controlled side-effects backlog recovery.
 *
 * Usage:
 *   node scripts/side-effects-recovery.mjs --dry-run
 *   node scripts/side-effects-recovery.mjs --batch=25 --max-batches=4
 *   node scripts/side-effects-recovery.mjs --invoke-edge
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local or .env for RPC/edge calls.
 * Falls back to `supabase db query --linked` when --use-cli is set.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const useCli = args.includes('--use-cli');
const invokeEdge = args.includes('--invoke-edge');
const batchArg = args.find((a) => a.startsWith('--batch='));
const maxBatchesArg = args.find((a) => a.startsWith('--max-batches='));
const batchSize = Math.min(200, Math.max(1, Number(batchArg?.split('=')[1] || 25)));
const maxBatches = Math.max(1, Number(maxBatchesArg?.split('=')[1] || 4));

function loadEnvFile(name) {
  const path = join(process.cwd(), name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return out;
}

const env = { ...process.env, ...loadEnvFile('.env'), ...loadEnvFile('.env.local') };
const url = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const workerSecret = env.BACKGROUND_WORKER_SECRET;

async function rpc(name, body = {}) {
  if (!url || !serviceKey) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(`${name} HTTP ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

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

async function snapshot(label) {
  const sql = `
    SELECT
      (SELECT count(*)::int FROM public.order_side_effects_outbox WHERE processed_at IS NULL) AS pending,
      (SELECT count(*)::int FROM public.order_side_effects_outbox WHERE processed_at IS NOT NULL) AS processed,
      (SELECT count(*)::int FROM public.order_side_effects_outbox WHERE last_error IS NOT NULL AND trim(last_error) <> '') AS with_errors,
      (SELECT count(*)::int FROM public.order_webhook_outbox WHERE status = 'pending') AS webhook_pending
  `;

  if (useCli || !serviceKey) {
    const out = cliQuery(sql);
    const row = out.rows?.[0] ?? {};
    console.log(`[${label}]`, row);
    return row;
  }

  const health = await rpc('side_effects_outbox_backlog_health').catch(() => null);
  const row = health
    ? {
        pending: health.pending,
        processed_last_60s: health.processed_last_60s,
        errors: health.errors,
        oldest_minutes: health.oldest_minutes,
        last_worker_success_at: health.last_worker_success_at,
      }
    : {};
  console.log(`[${label}]`, row);
  return row;
}

async function classifyBacklog() {
  const sql = `
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.shipments s WHERE s.order_id = o.order_id))::int AS already_has_shipment,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.order_webhook_outbox w WHERE w.order_id = o.order_id AND w.event_type = 'order.created'))::int AS already_has_webhook,
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.orders ord WHERE ord.id = o.order_id))::int AS orphaned
    FROM public.order_side_effects_outbox o
    WHERE o.processed_at IS NULL
  `;

  if (useCli || !serviceKey) {
    return cliQuery(sql).rows?.[0] ?? {};
  }

  // No dedicated RPC — use CLI fallback message
  console.warn('Classification requires --use-cli or extend with service role + raw SQL');
  return {};
}

async function invokeEdgeWorker(limit) {
  if (!workerSecret) throw new Error('BACKGROUND_WORKER_SECRET required for --invoke-edge');
  const res = await fetch(`${url}/functions/v1/process-order-webhook-outbox?limit=${limit}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const text = await res.text();
  console.log('[edge-worker]', res.status, text.slice(0, 500));
  if (!res.ok) throw new Error(`Edge worker failed: ${res.status}`);
  return JSON.parse(text);
}

async function main() {
  console.log('Side effects recovery — Phase 0.3');
  console.log({ dryRun, batchSize, maxBatches, useCli, invokeEdge });

  const classification = await classifyBacklog();
  if (Object.keys(classification).length) {
    console.log('[classification]', classification);
    if (classification.orphaned > 0) {
      console.warn(`WARNING: ${classification.orphaned} orphaned rows — review before bulk recovery`);
    }
  }

  const before = await snapshot('before');

  if (dryRun) {
    console.log('Dry run — no batches executed');
    return;
  }

  for (let i = 0; i < maxBatches; i += 1) {
    console.log(`\n--- batch ${i + 1}/${maxBatches} (limit=${batchSize}) ---`);

    if (invokeEdge) {
      await invokeEdgeWorker(batchSize);
    } else if (useCli) {
      const out = cliQuery(`SELECT public.process_order_side_effects_batch(${batchSize}) AS result`);
      console.log(out.rows?.[0]?.result ?? out);
    } else {
      const result = await rpc('process_order_side_effects_batch', { p_limit: batchSize });
      console.log(result);
      if (result?.processed === 0 && (result?.pending ?? 0) > 0) {
        console.warn('Batch processed 0 rows — check last_error on outbox or upsert guard');
        break;
      }
    }

    await snapshot(`after-batch-${i + 1}`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  const after = await snapshot('after');
  console.log('\nSummary', { before, after });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
