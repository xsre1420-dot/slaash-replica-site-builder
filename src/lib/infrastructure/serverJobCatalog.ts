/**
 * Server-side background job catalog — Postgres outboxes, pg_cron, Edge workers.
 * Read-only registry for Phase 4.4+ migration planning.
 */
export type ServerJobPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';
export type ServerJobTrigger = 'pg_cron' | 'edge_cron' | 'edge_on_demand' | 'rpc_inline' | 'webhook';

export type ServerJobEntry = {
  id: string;
  name: string;
  trigger: ServerJobTrigger;
  priority: ServerJobPriority;
  processor: string;
  retryLimit: number | 'unbounded';
  deadLetter: boolean;
  recurring: boolean;
  notes: string;
};

export const SERVER_JOB_CATALOG: ServerJobEntry[] = [
  {
    id: 'analytics.buffer_flush',
    name: 'Analytics outbox batch processor',
    trigger: 'pg_cron',
    priority: 'normal',
    processor: 'process_analytics_event_buffer',
    retryLimit: 8,
    deadLetter: true,
    recurring: true,
    notes: 'Every minute via pg_cron; exponential backoff; retry_analytics_dead_letter for DLQ',
  },
  {
    id: 'analytics.prune',
    name: 'Analytics outbox retention prune',
    trigger: 'pg_cron',
    priority: 'background',
    processor: 'prune_analytics_event_outbox',
    retryLimit: 'unbounded',
    deadLetter: false,
    recurring: true,
    notes: 'Daily at 03:00 UTC',
  },
  {
    id: 'webhook.claim_deliver',
    name: 'Order webhook HTTP delivery',
    trigger: 'edge_cron',
    priority: 'high',
    processor: 'process-order-webhook-outbox',
    retryLimit: 5,
    deadLetter: true,
    recurring: true,
    notes: 'claim → HTTP POST → finalize_order_webhook_delivery per job',
  },
  {
    id: 'webhook.stale_recovery',
    name: 'Stale webhook processing recovery',
    trigger: 'pg_cron',
    priority: 'high',
    processor: 'recover_stale_webhook_processing',
    retryLimit: 'unbounded',
    deadLetter: false,
    recurring: true,
    notes: 'Every 5 min; resets processing > 15 min',
  },
  {
    id: 'side_effects.batch',
    name: 'Order side effects outbox',
    trigger: 'edge_cron',
    priority: 'high',
    processor: 'process_order_side_effects_batch',
    retryLimit: 10,
    deadLetter: true,
    recurring: true,
    notes: 'Backoff + DLQ; retry_side_effects_dead_letter for merchant replay',
  },
  {
    id: 'background.bundle',
    name: 'Unified background worker bundle',
    trigger: 'edge_cron',
    priority: 'normal',
    processor: 'process_background_worker_bundle',
    retryLimit: 1,
    deadLetter: false,
    recurring: true,
    notes: 'Side effects + analytics + webhook recovery + lifecycle in one RPC',
  },
  {
    id: 'lifecycle.platform',
    name: 'Platform data lifecycle',
    trigger: 'pg_cron',
    priority: 'background',
    processor: 'platform_run_data_lifecycle',
    retryLimit: 'unbounded',
    deadLetter: false,
    recurring: true,
    notes: 'Partition maintenance, prune outboxes, ANALYZE',
  },
  {
    id: 'import.batch',
    name: 'Product CSV import batch',
    trigger: 'edge_on_demand',
    priority: 'normal',
    processor: 'process_product_import_batch',
    retryLimit: 'unbounded',
    deadLetter: false,
    recurring: false,
    notes: 'Client sync loop or process-import-jobs edge; recover_stale_import_jobs in worker bundle',
  },
  {
    id: 'import.stale_recovery',
    name: 'Stale import job recovery',
    trigger: 'edge_cron',
    priority: 'normal',
    processor: 'recover_stale_import_jobs',
    retryLimit: 'unbounded',
    deadLetter: false,
    recurring: true,
    notes: 'Resets processing jobs stuck > 30 min — runs in process_background_worker_bundle',
  },
  {
    id: 'queue.health_audit',
    name: 'Unified queue health audit',
    trigger: 'edge_cron',
    priority: 'high',
    processor: 'platform_queue_health_audit',
    retryLimit: 1,
    deadLetter: false,
    recurring: true,
    notes: 'Worker stale detection across all outboxes — service_role only',
  },
  {
    id: 'payment.stripe_webhook',
    name: 'Stripe payment webhook ingest',
    trigger: 'webhook',
    priority: 'critical',
    processor: 'process_payment_webhook_event',
    retryLimit: 'unbounded',
    deadLetter: false,
    recurring: false,
    notes: 'Idempotent by Stripe event ID',
  },
  {
    id: 'meta.conversions',
    name: 'Meta CAPI conversion dispatch',
    trigger: 'edge_on_demand',
    priority: 'normal',
    processor: 'meta-conversions',
    retryLimit: 3,
    deadLetter: false,
    recurring: false,
    notes: 'Triggered from client orders queue; rate limited at edge',
  },
  {
    id: 'analytics.merchant_flush',
    name: 'Merchant analytics buffer flush',
    trigger: 'rpc_inline',
    priority: 'normal',
    processor: 'flush_merchant_analytics_buffer',
    retryLimit: 1,
    deadLetter: false,
    recurring: false,
    notes: 'Called before dashboard/statistics loads',
  },
  {
    id: 'webhook.merchant_retry',
    name: 'Merchant webhook DLQ replay',
    trigger: 'rpc_inline',
    priority: 'high',
    processor: 'retry_order_webhook_events',
    retryLimit: 1,
    deadLetter: false,
    recurring: false,
    notes: 'Merchant-initiated reset of failed webhook events',
  },
];

export function listRecurringServerJobs(): ServerJobEntry[] {
  return SERVER_JOB_CATALOG.filter((j) => j.recurring);
}

export function listDeadLetterCapableJobs(): ServerJobEntry[] {
  return SERVER_JOB_CATALOG.filter((j) => j.deadLetter);
}
