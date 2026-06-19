import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeOrderStats } from '@/utils/orderWorkflowUtils';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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
  });

  it('aggregates stats from full order query not paginated slice', async () => {
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
