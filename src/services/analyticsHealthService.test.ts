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

import { auditMerchantAnalyticsHealth } from './analyticsHealthService';

describe('analyticsHealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps audit_merchant_analytics_health RPC payload', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        score: 92,
        pending_buffered_events: 3,
        today_visits_raw: 40,
        today_visits_rollup: 37,
        rollup_lag: 6,
        recommendation: 'Minor buffer lag — will flush on next cron cycle',
      },
      error: null,
    });

    const result = await auditMerchantAnalyticsHealth('owner-1');
    expect(result?.score).toBe(92);
    expect(result?.pendingBufferedEvents).toBe(3);
    expect(result?.rollupLag).toBe(6);
    expect(mockRpc).toHaveBeenCalledWith('audit_merchant_analytics_health', {
      p_owner_id: 'owner-1',
    });
  });

  it('returns null when RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: 'forbidden' }, error: null });
    expect(await auditMerchantAnalyticsHealth('owner-1')).toBeNull();
  });
});
