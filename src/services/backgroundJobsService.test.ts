import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockCallReadRpc = vi.fn();
const mockCallWriteRpc = vi.fn();

vi.mock('@/lib/readWrite/readClient', () => ({
  callReadRpc: (...args: unknown[]) => mockCallReadRpc(...args),
}));

vi.mock('@/lib/readWrite/writeClient', () => ({
  callWriteRpc: (...args: unknown[]) => mockCallWriteRpc(...args),
}));

vi.mock('@/lib/tenantGuard', () => ({
  assertMerchantOwner: vi.fn().mockResolvedValue(undefined),
}));

import {
  fetchBackgroundJobsStatus,
  fetchQueueHealthAudit,
  fetchWorkerHealthAudit,
  retryFailedWebhookEvents,
  retrySideEffectsDeadLetter,
} from './backgroundJobsService';

describe('backgroundJobsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps get_background_jobs_status payload with DLQ and worker stale', async () => {
    mockCallReadRpc.mockResolvedValue({
      data: {
        success: true,
        status: 'warn',
        analytics: {
          pending: 12,
          oldest_pending_seconds: 90,
          dead_letter: 3,
          worker_stale: true,
          processor: 'process_analytics_event_buffer',
        },
        order_webhooks: {
          pending: 3,
          processing: 1,
          failed_dead_letter: 2,
          oldest_pending_seconds: 45,
          worker_stale: false,
          processor: 'claim_order_webhook_outbox_batch + edge worker',
        },
        order_side_effects: {
          pending: 5,
          oldest_pending_seconds: 30,
          dead_letter: 1,
          worker_stale: false,
          processor: 'process_order_side_effects_batch',
        },
        workers: {
          bundle_stale: true,
          webhook_worker_stale: false,
          primary: 'process-background-queue + process-order-webhook-outbox',
          fallback: 'pg_cron conditional fallbacks',
        },
        recommendations: ['run process_analytics_event_buffer'],
      },
      error: null,
    });

    const status = await fetchBackgroundJobsStatus();
    expect(status?.status).toBe('warn');
    expect(status?.analytics.pending).toBe(12);
    expect(status?.analytics.deadLetter).toBe(3);
    expect(status?.analytics.workerStale).toBe(true);
    expect(status?.orderWebhooks.failedDeadLetter).toBe(2);
    expect(status?.orderSideEffects?.deadLetter).toBe(1);
    expect(status?.workers?.bundleStale).toBe(true);
    expect(status?.recommendations).toContain('run process_analytics_event_buffer');
  });

  it('retries failed webhook events for merchant', async () => {
    mockCallWriteRpc.mockResolvedValue({ data: { success: true, reset: 2 }, error: null });
    const result = await retryFailedWebhookEvents('owner-1');
    expect(result?.reset).toBe(2);
    expect(mockCallWriteRpc).toHaveBeenCalledWith('retry_order_webhook_events', {
      p_owner_id: 'owner-1',
      p_event_ids: null,
    });
  });

  it('retries side effects dead letter for merchant', async () => {
    mockCallWriteRpc.mockResolvedValue({ data: { success: true, reset: 4 }, error: null });
    const result = await retrySideEffectsDeadLetter('owner-1', 25);
    expect(result?.reset).toBe(4);
    expect(mockCallWriteRpc).toHaveBeenCalledWith('retry_side_effects_dead_letter', {
      p_owner_id: 'owner-1',
      p_limit: 25,
    });
  });

  it('maps platform_worker_health_audit payload', async () => {
    mockCallReadRpc.mockResolvedValue({
      data: {
        overall: 'ok',
        stale_workers: 0,
        workers: [{ worker_id: 'process_background_worker_bundle', stale: false }],
        pg_cron_jobs: [{ jobname: 'worker-health-check', active: true }],
        queue_health: { critical: false },
        recommendations: [],
      },
      error: null,
    });

    const audit = await fetchWorkerHealthAudit();
    expect(audit?.overall).toBe('ok');
    expect(audit?.workers).toHaveLength(1);
    expect(mockCallReadRpc).toHaveBeenCalledWith('platform_worker_health_audit');
  });
});
