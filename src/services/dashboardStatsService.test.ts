import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDashboardKpisLight,
  fetchDashboardWorkflowCounts,
} from '@/services/dashboardStatsService';

const mockCallReadRpc = vi.fn();
const mockHasKpis = vi.fn();
const mockHasWorkflow = vi.fn();

vi.mock('@/lib/readWrite/readClient', () => ({
  callReadRpc: (...args: unknown[]) => mockCallReadRpc(...args),
}));

vi.mock('@/lib/supabase/schemaCapabilities', () => ({
  hasDashboardKpisLightRpc: () => mockHasKpis(),
  hasDashboardWorkflowCountsRpc: () => mockHasWorkflow(),
}));

vi.mock('@/lib/analytics/analyticsFlushQueue', () => ({
  scheduleMerchantAnalyticsFlush: vi.fn(),
}));

vi.mock('@/lib/cache/dashboardCacheLayer', () => ({
  fetchDashboardKpisLightCached: (_ownerId: string, fn: () => Promise<unknown>) => fn(),
  fetchDashboardWorkflowCountsCached: (_ownerId: string, fn: () => Promise<unknown>) => fn(),
  fetchDashboardBatchCached: vi.fn(),
  invalidateDashboardCaches: vi.fn(),
}));

describe('dashboardStatsService production fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasKpis.mockResolvedValue(false);
    mockHasWorkflow.mockResolvedValue(false);
  });

  it('derives KPI light payload from statistics batch when dedicated RPC is absent', async () => {
    mockCallReadRpc.mockImplementation(async (name: string) => {
      if (name === 'get_dashboard_statistics_batch') {
        return {
          data: {
            today: { order_count: 3, completed_revenue: 300 },
            week: { order_count: 10, completed_revenue: 1000 },
            all_time: { product_count: 25, low_stock_count: 2 },
          },
          error: null,
        };
      }
      return { data: null, error: 'missing' };
    });

    const kpis = await fetchDashboardKpisLight('owner-1');
    expect(kpis?.today).toMatchObject({ orders: 3, revenue: 300 });
    expect(kpis?.catalog_kpis).toMatchObject({ productCount: 25, lowStockCount: 2 });
  });

  it('derives workflow counts from statistics batch when dedicated RPC is absent', async () => {
    mockCallReadRpc.mockImplementation(async (name: string) => {
      if (name === 'get_dashboard_statistics_batch') {
        return {
          data: {
            workflow_counts: { new: 4, completed: 12, cancelled: 1 },
          },
          error: null,
        };
      }
      return { data: null, error: 'missing' };
    });

    const counts = await fetchDashboardWorkflowCounts('owner-1');
    expect(counts).toEqual({ new: 4, completed: 12, cancelled: 1 });
  });
});
