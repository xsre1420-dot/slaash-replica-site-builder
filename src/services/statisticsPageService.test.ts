import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import type { DatabaseData } from '@/types/statistics';
import {
  loadStatisticsPageBundle,
  peekStatisticsPageBundle,
} from '@/services/statisticsService';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/tenantGuard', () => ({
  assertMerchantOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/readWrite/readClient', () => ({
  callReadRpc: vi.fn().mockResolvedValue({
    data: {
      current: { order_count: 3, visit_count: 10, product_count: 5, top_selling_products: [] },
      previous: { order_count: 2, visit_count: 8 },
    },
    error: null,
  }),
}));

vi.mock('@/services/analyticsTrackingService', () => ({
  flushMerchantAnalyticsBuffer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/customerService', () => ({
  fetchCustomerMetricsForPeriod: vi.fn().mockResolvedValue(null),
}));

describe('statisticsPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekStatisticsPageBundle returns null when cache is cold', () => {
    expect(peekStatisticsPageBundle('owner-1', '7')).toBeNull();
  });

  it('peekStatisticsPageBundle reads warmed page bundle', () => {
    const payload: DatabaseData = {
      orders: [],
      orderItems: [],
      customers: [],
      products: [],
      visits: [],
      kpis: { order_count: 1 },
      truncated: false,
    };
    cache.set(CacheKeys.statistics('owner-1', '7'), payload, CacheTTL.ANALYTICS, CacheTTL.ANALYTICS_STALE);

    expect(peekStatisticsPageBundle('owner-1', '7')?.kpis?.order_count).toBe(1);
  });

  it('loadStatisticsPageBundle dedupes concurrent loads', async () => {
    const [a, b] = await Promise.all([
      loadStatisticsPageBundle('7'),
      loadStatisticsPageBundle('7'),
    ]);

    expect(a.kpis?.order_count).toBe(3);
    expect(b.kpis?.order_count).toBe(3);
  });
});
