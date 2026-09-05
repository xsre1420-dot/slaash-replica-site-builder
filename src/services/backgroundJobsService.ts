import { callReadRpc } from '@/lib/readWrite/readClient';
import { callWriteRpc } from '@/lib/readWrite/writeClient';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import { getClientBackgroundStatus } from '@/background/scheduler/JobScheduler';
import type { ClientBackgroundStatus } from '@/background/shared/types';

export type { ClientBackgroundStatus };

export type BackgroundJobsStatus = {
  status: 'ok' | 'warn' | 'degraded' | 'critical';
  analytics: {
    pending: number;
    oldestPendingSeconds: number;
    deadLetter?: number;
    workerStale?: boolean;
    processor: string;
  };
  orderWebhooks: {
    pending: number;
    processing: number;
    failedDeadLetter: number;
    oldestPendingSeconds: number;
    workerStale?: boolean;
    processor: string;
  };
  orderSideEffects?: {
    pending: number;
    oldestPendingSeconds: number;
    deadLetter?: number;
    workerStale?: boolean;
    processor: string;
  };
  recommendations: string[];
  client?: ClientBackgroundStatus;
  workers?: {
    bundleStale?: boolean;
    webhookWorkerStale?: boolean;
    primary?: string;
    fallback?: string;
  };
};

export type QueueHealthAudit = {
  critical: boolean;
  analytics: Record<string, unknown>;
  sideEffects: Record<string, unknown>;
  webhooks: Record<string, unknown>;
  importJobs: Record<string, unknown>;
  recommendations: string[];
};

export type WorkerHealthAudit = {
  overall: 'ok' | 'degraded' | 'critical';
  staleWorkers: number;
  workers: Array<Record<string, unknown>>;
  pgCronJobs: Array<Record<string, unknown>>;
  queueHealth: Record<string, unknown>;
  recommendations: string[];
};

export type WebhookRetryResult = {
  reset: number;
};

/** Service-role only via RPC — returns null for merchant sessions. */
export const fetchBackgroundJobsStatus = async (): Promise<BackgroundJobsStatus | null> => {
  const { data, error } = await callReadRpc<Record<string, unknown>>('get_background_jobs_status');
  const payload = data as {
    success?: boolean;
    status?: BackgroundJobsStatus['status'];
    analytics?: Record<string, unknown>;
    order_webhooks?: Record<string, unknown>;
    order_side_effects?: Record<string, unknown>;
    recommendations?: string[] | unknown;
  };

  if (error || !payload?.success) return null;

  const recs = payload.recommendations;
  const recommendations = Array.isArray(recs)
    ? recs.filter((r): r is string => typeof r === 'string')
    : [];

  return {
    status: payload.status ?? 'ok',
    analytics: {
      pending: Number(payload.analytics?.pending ?? 0),
      oldestPendingSeconds: Number(payload.analytics?.oldest_pending_seconds ?? 0),
      deadLetter: Number(payload.analytics?.dead_letter ?? 0),
      workerStale: Boolean(payload.analytics?.worker_stale),
      processor: String(payload.analytics?.processor ?? 'process_analytics_event_buffer'),
    },
    orderWebhooks: {
      pending: Number(payload.order_webhooks?.pending ?? 0),
      processing: Number(payload.order_webhooks?.processing ?? 0),
      failedDeadLetter: Number(payload.order_webhooks?.failed_dead_letter ?? 0),
      oldestPendingSeconds: Number(payload.order_webhooks?.oldest_pending_seconds ?? 0),
      workerStale: Boolean(payload.order_webhooks?.worker_stale),
      processor: String(
        payload.order_webhooks?.processor ?? 'claim_order_webhook_outbox_batch'
      ),
    },
    orderSideEffects: payload.order_side_effects
      ? {
          pending: Number(payload.order_side_effects.pending ?? 0),
          oldestPendingSeconds: Number(payload.order_side_effects.oldest_pending_seconds ?? 0),
          deadLetter: Number(payload.order_side_effects.dead_letter ?? 0),
          workerStale: Boolean(payload.order_side_effects.worker_stale),
          processor: String(
            payload.order_side_effects.processor ?? 'process_order_side_effects_batch'
          ),
        }
      : undefined,
    recommendations,
    workers: payload.workers
      ? {
          bundleStale: Boolean((payload.workers as Record<string, unknown>).bundle_stale),
          webhookWorkerStale: Boolean((payload.workers as Record<string, unknown>).webhook_worker_stale),
          primary: String((payload.workers as Record<string, unknown>).primary ?? ''),
          fallback: String((payload.workers as Record<string, unknown>).fallback ?? ''),
        }
      : undefined,
  };
};

export const retryAnalyticsDeadLetter = async (limit = 100): Promise<{ reset: number } | null> => {
  const { data, error } = await callWriteRpc<Record<string, unknown>>('retry_analytics_dead_letter', {
    p_limit: limit,
  });

  const payload = data as { success?: boolean; reset?: number };
  if (error || !payload?.success) return null;
  return { reset: payload.reset ?? 0 };
};

export const retrySideEffectsDeadLetter = async (
  ownerId: string,
  limit = 50
): Promise<{ reset: number } | null> => {
  await assertMerchantOwner(ownerId);

  const { data, error } = await callWriteRpc<Record<string, unknown>>(
    'retry_side_effects_dead_letter',
    { p_owner_id: ownerId, p_limit: limit }
  );

  const payload = data as { success?: boolean; reset?: number };
  if (error || !payload?.success) return null;
  return { reset: payload.reset ?? 0 };
};

/** Service-role worker audit — null for merchant sessions. */
export const fetchWorkerHealthAudit = async (): Promise<WorkerHealthAudit | null> => {
  const { data, error } = await callReadRpc<Record<string, unknown>>('platform_worker_health_audit');
  if (error || !data) return null;

  const recs = data.recommendations;
  const workers = data.workers;
  const cronJobs = data.pg_cron_jobs;

  return {
    overall: (data.overall as WorkerHealthAudit['overall']) ?? 'ok',
    staleWorkers: Number(data.stale_workers ?? 0),
    workers: Array.isArray(workers)
      ? workers.filter((w): w is Record<string, unknown> => typeof w === 'object' && w !== null)
      : [],
    pgCronJobs: Array.isArray(cronJobs)
      ? cronJobs.filter((j): j is Record<string, unknown> => typeof j === 'object' && j !== null)
      : [],
    queueHealth: (data.queue_health as Record<string, unknown>) ?? {},
    recommendations: Array.isArray(recs) ? recs.filter((r): r is string => typeof r === 'string') : [],
  };
};

/** Service-role queue audit — null for merchant sessions. */
export const fetchQueueHealthAudit = async (): Promise<QueueHealthAudit | null> => {
  const { data, error } = await callReadRpc<Record<string, unknown>>('platform_queue_health_audit');
  if (error || !data) return null;

  const recs = data.recommendations;
  return {
    critical: Boolean(data.critical),
    analytics: (data.analytics as Record<string, unknown>) ?? {},
    sideEffects: (data.side_effects as Record<string, unknown>) ?? {},
    webhooks: (data.webhooks as Record<string, unknown>) ?? {},
    importJobs: (data.import_jobs as Record<string, unknown>) ?? {},
    recommendations: Array.isArray(recs) ? recs.filter((r): r is string => typeof r === 'string') : [],
  };
};

export const retryFailedWebhookEvents = async (
  ownerId: string,
  eventIds?: string[]
): Promise<WebhookRetryResult | null> => {
  await assertMerchantOwner(ownerId);

  const { data, error } = await callWriteRpc<Record<string, unknown>>('retry_order_webhook_events', {
    p_owner_id: ownerId,
    p_event_ids: eventIds?.length ? eventIds : null,
  });

  const payload = data as { success?: boolean; reset?: number };
  if (error || !payload?.success) return null;

  return { reset: payload.reset ?? 0 };
};

/** Unified server outbox + client queue monitoring. */
export const fetchUnifiedBackgroundStatus = async (): Promise<BackgroundJobsStatus | null> => {
  const server = await fetchBackgroundJobsStatus();
  const client = typeof window !== 'undefined' ? getClientBackgroundStatus() : undefined;
  if (!server && !client) return null;
  if (!server) {
    return {
      status: 'ok',
      analytics: { pending: 0, oldestPendingSeconds: 0, processor: 'client-only' },
      orderWebhooks: {
        pending: 0,
        processing: 0,
        failedDeadLetter: 0,
        oldestPendingSeconds: 0,
        processor: 'client-only',
      },
      recommendations: [],
      client,
    };
  }
  return { ...server, client };
};
