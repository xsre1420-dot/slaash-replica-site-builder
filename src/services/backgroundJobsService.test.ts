import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: mockRpc },
}));

vi.mock('@/lib/tenantGuard', () => ({
  assertMerchantOwner: vi.fn().mockResolvedValue(undefined),
}));

import { fetchBackgroundJobsStatus, retryFailedWebhookEvents } from './backgroundJobsService';

describe('backgroundJobsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps get_background_jobs_status payload', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        status: 'warn',
        analytics: { pending: 12, oldest_pending_seconds: 90, processor: 'process_analytics_event_buffer' },
        order_webhooks: {
          pending: 3,
          processing: 1,
          failed_dead_letter: 2,
          oldest_pending_seconds: 45,
          processor: 'claim_order_webhook_outbox_batch + edge worker',
        },
        recommendations: ['run process_analytics_event_buffer'],
      },
      error: null,
    });

    const status = await fetchBackgroundJobsStatus();
    expect(status?.status).toBe('warn');
    expect(status?.analytics.pending).toBe(12);
    expect(status?.orderWebhooks.failedDeadLetter).toBe(2);
    expect(status?.recommendations).toContain('run process_analytics_event_buffer');
  });

  it('retries failed webhook events for merchant', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, reset: 2 }, error: null });
    const result = await retryFailedWebhookEvents('owner-1');
    expect(result?.reset).toBe(2);
    expect(mockRpc).toHaveBeenCalledWith('retry_order_webhook_events', {
      p_owner_id: 'owner-1',
      p_event_ids: null,
    });
  });
});
