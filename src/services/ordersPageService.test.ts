import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '@/lib/cache';
import { DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';
import { serializeOrderFilters } from '@/utils/orderQueryBuilder';
import {
  loadOrdersPageBundle,
  peekOrdersPageBundle,
  invalidateOrdersPageBundle,
} from '@/services/ordersPageService';

const mockOrders = [
  {
    id: 'ord-1',
    status: 'pending' as const,
    total: 10000,
    date: '2026-01-01',
    customerInfo: { name: 'Ali', phone: '07701234567', address: 'Baghdad' },
    items: [],
  },
];

const mockBatch = {
  today: { orders: 1, revenue: 10000, visitors: 0, views: 0 },
  yesterday: null,
  week: { orders: 2, revenue: 20000, visitors: 0, views: 0 },
  previousWeek: null,
  month: { orders: 5, revenue: 50000, visitors: 0, views: 0 },
  allTime: { revenue: 50000, order_count: 5 },
  workflowCounts: { new: 3, completed: 2, cancelled: 0 },
  catalogKpis: null,
};

vi.mock('@/services/orderService', () => ({
  ORDERS_PER_PAGE: 50,
  fetchOrdersFiltered: vi.fn(async () => ({
    orders: mockOrders,
    total: 1,
    page: 0,
    pageSize: 50,
    totalPages: 1,
    nextCursor: null,
  })),
  fetchWorkflowTabCounts: vi.fn(async () => ({ new: 3, completed: 2, cancelled: 0 })),
  fetchOrderStatsSummary: vi.fn(async () => ({
    total: 5,
    newOrders: 3,
    pendingFulfillment: 3,
    delivered: 2,
    revenue: 50000,
    todayRevenue: 10000,
    weekRevenue: 20000,
    monthRevenue: 50000,
    pendingRevenue: 0,
    avgOrderValue: 25000,
    todayOrders: 1,
    weekOrders: 2,
    monthOrders: 5,
  })),
}));

vi.mock('@/services/dashboardStatsService', () => ({
  fetchDashboardStatisticsBatch: vi.fn(async () => mockBatch),
  buildOrderDashboardStatsFromBatch: vi.fn(() => ({
    total: 5,
    newOrders: 3,
    pendingFulfillment: 3,
    delivered: 2,
    revenue: 50000,
    todayRevenue: 10000,
    weekRevenue: 20000,
    monthRevenue: 50000,
    pendingRevenue: 0,
    avgOrderValue: 25000,
    todayOrders: 1,
    weekOrders: 2,
    monthOrders: 5,
  })),
}));

describe('ordersPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekOrdersPageBundle returns null when cache is cold', () => {
    expect(peekOrdersPageBundle('owner-1', DEFAULT_ORDER_FILTERS)).toBeNull();
  });

  it('loadOrdersPageBundle dedupes concurrent loads and caches bundle', async () => {
    const [a, b] = await Promise.all([
      loadOrdersPageBundle('owner-1', DEFAULT_ORDER_FILTERS, 0),
      loadOrdersPageBundle('owner-1', DEFAULT_ORDER_FILTERS, 0),
    ]);

    expect(a.orders).toHaveLength(1);
    expect(a.tabCounts.new).toBe(3);
    expect(a.stats.revenue).toBe(50000);
    expect(b.total).toBe(1);
    expect(peekOrdersPageBundle('owner-1', DEFAULT_ORDER_FILTERS, 0)?.orders[0].id).toBe('ord-1');
  });

  it('invalidateOrdersPageBundle clears cached bundle', async () => {
    await loadOrdersPageBundle('owner-2', DEFAULT_ORDER_FILTERS, 0);
    const filterKey = serializeOrderFilters(DEFAULT_ORDER_FILTERS);
    invalidateOrdersPageBundle('owner-2', filterKey, 0);
    expect(peekOrdersPageBundle('owner-2', DEFAULT_ORDER_FILTERS, 0)).toBeNull();
  });
});
