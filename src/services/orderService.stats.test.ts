import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeOrderStats } from '@/utils/orderWorkflowUtils';

const mockFrom = vi.fn();
const mockCallRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/integrations/supabase/rpc', () => ({
  callSupabaseRpc: (...args: unknown[]) => mockCallRpc(...args),
}));

vi.mock('@/lib/observability', () => ({
  instrumentAsync: (_op: string, fn: () => Promise<unknown>) => fn(),
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/tenantGuard', () => ({
  assertMerchantOwner: vi.fn().mockResolvedValue(undefined),
}));

import { fetchOrderStatsSummary } from '@/services/orderService';

const workflowCounts = {
  new: 1,
  completed: 1,
  cancelled: 0,
};

describe('fetchOrderStatsSummary', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockCallRpc.mockReset();
    mockCallRpc.mockResolvedValue({ data: null, error: 'RPC unavailable' });
  });

  it('aggregates stats from batch RPC when available', async () => {
    mockCallRpc.mockImplementation((name: string) => {
      if (name === 'get_dashboard_statistics_batch') {
        return Promise.resolve({
          data: {
            today: { order_count: 2, completed_revenue: 100, visit_count: 5 },
            yesterday: { order_count: 1, completed_revenue: 50, visit_count: 2 },
            week: { order_count: 2, completed_revenue: 200, visit_count: 10 },
            previous_week: { order_count: 0, completed_revenue: 0, visit_count: 0 },
            month: { order_count: 2, completed_revenue: 500, visit_count: 12 },
            all_time: { order_count: 10, completed_revenue: 500, visit_count: 100 },
            workflow_counts: workflowCounts,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: 'unknown' });
    });

    const stats = await fetchOrderStatsSummary('owner-1');
    expect(stats.total).toBe(2);
    expect(stats.revenue).toBe(500);
    expect(stats.newOrders).toBe(1);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('falls back to order rows when RPC is unavailable', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          { id: '1', status: 'pending', total_amount: 100, payment_status: null, delivery_status: null, created_at: '2026-01-01' },
          { id: '2', status: 'completed', total_amount: 500, payment_status: 'collected', delivery_status: 'delivered', created_at: '2026-01-02' },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const stats = await fetchOrderStatsSummary('owner-1');
    expect(stats.total).toBe(2);
    expect(stats.revenue).toBe(500);
    expect(stats.newOrders).toBe(1);
  });
});

describe('computeOrderStats sanity', () => {
  it('matches dashboard shape', () => {
    const stats = computeOrderStats([]);
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('revenue');
    expect(stats).toHaveProperty('todayOrders');
    expect(stats).toHaveProperty('weekOrders');
    expect(stats).toHaveProperty('monthOrders');
  });
});
