import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeOrderStats } from '@/utils/orderWorkflowUtils';

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@/lib/observability', () => ({
  instrumentAsync: (_op: string, fn: () => Promise<unknown>) => fn(),
  logger: { error: vi.fn() },
}));

import { fetchOrderStatsSummary } from '@/services/orderService';

describe('fetchOrderStatsSummary', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } });
  });

  it('aggregates stats from RPC when available', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_store_statistics') {
        return Promise.resolve({
          data: { order_count: 2, completed_revenue: 500, pending_count: 1 },
          error: null,
        });
      }
      if (name === 'count_merchant_orders_by_workflow') {
        return Promise.resolve({
          data: {
            all: 2,
            new: 1,
            processing: 0,
            paid: 0,
            shipped: 0,
            delivered: 1,
            cancelled: 0,
            refunded: 0,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: 'unknown' } });
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
