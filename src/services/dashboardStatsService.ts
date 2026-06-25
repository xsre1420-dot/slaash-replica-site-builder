import { supabase } from '@/integrations/supabase/client';
import { cache, CacheKeys, CacheTTL, dedup } from '@/lib/cache';
import {
  parseRpcPeriodMetrics,
  type PeriodMetrics,
} from '@/utils/dashboardInsightsUtils';
import { netRevenueFromRpc } from '@/utils/analyticsMetrics';
import type { OrderDashboardStats, WorkflowTabCounts } from '@/types/orders';

export type DashboardBatchPayload = {
  today: PeriodMetrics | null;
  yesterday: PeriodMetrics | null;
  week: PeriodMetrics | null;
  previousWeek: PeriodMetrics | null;
  month: PeriodMetrics | null;
  allTime: Record<string, unknown> | null;
  workflowCounts: WorkflowTabCounts | null;
};

const parsePeriod = (value: unknown): PeriodMetrics | null => {
  if (!value || typeof value !== 'object') return null;
  return parseRpcPeriodMetrics(value as Record<string, unknown>);
};

export const invalidateDashboardBatchCache = (ownerId: string): void => {
  cache.del(CacheKeys.dashboardBatch(ownerId));
};

export const fetchDashboardStatisticsBatch = async (
  ownerId: string
): Promise<DashboardBatchPayload | null> => {
  const cacheKey = CacheKeys.dashboardBatch(ownerId);
  const cached = cache.get<DashboardBatchPayload>(cacheKey);
  if (cached) return cached;

  return dedup(cacheKey, async () => {
    try {
      const { data, error } = await (supabase as any).rpc('get_dashboard_statistics_batch', {
        p_owner_id: ownerId,
      });

      if (error || !data) {
        return null;
      }

      const payload = data as Record<string, unknown>;
      const result: DashboardBatchPayload = {
        today: parsePeriod(payload.today),
        yesterday: parsePeriod(payload.yesterday),
        week: parsePeriod(payload.week),
        previousWeek: parsePeriod(payload.previous_week),
        month: parsePeriod(payload.month),
        allTime: (payload.all_time as Record<string, unknown>) ?? null,
        workflowCounts: (payload.workflow_counts as WorkflowTabCounts) ?? null,
      };

      cache.set(cacheKey, result, CacheTTL.ANALYTICS, CacheTTL.ANALYTICS_STALE);
      return result;
    } catch {
      return null;
    }
  });
};

/** Single-period KPI fetch — used when dashboard batch RPC is unavailable. */
export const fetchStoreStatisticsPeriod = async (
  ownerId: string,
  start: string,
  end: string
): Promise<PeriodMetrics | null> => {
  try {
    const { data, error } = await (supabase as any).rpc('get_store_statistics', {
      p_owner_id: ownerId,
      p_start: start,
      p_end: end,
    });
    if (error || !data) return null;
    return parseRpcPeriodMetrics(data as Record<string, unknown>);
  } catch {
    return null;
  }
};

export const buildOrderDashboardStatsFromBatch = (
  batch: DashboardBatchPayload
): OrderDashboardStats => {
  const counts = batch.workflowCounts;
  const month = batch.month;
  const today = batch.today;
  const week = batch.week;
  const allTime = batch.allTime;

  return {
    total: counts?.all ?? month?.orders ?? 0,
    newOrders: counts?.new ?? 0,
    pendingFulfillment: (counts?.new ?? 0) + (counts?.processing ?? 0) + (counts?.paid ?? 0),
    delivered: counts?.delivered ?? 0,
    revenue: netRevenueFromRpc(allTime) || month?.revenue || 0,
    todayOrders: today?.orders ?? 0,
    weekOrders: week?.orders ?? 0,
    monthOrders: month?.orders ?? 0,
  };
};
