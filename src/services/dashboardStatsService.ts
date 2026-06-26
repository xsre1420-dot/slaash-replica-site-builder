import { callSupabaseRpc } from '@/integrations/supabase/rpc';
import { cache, CacheKeys, CacheTTL, dedup } from '@/lib/cache';
import {
  parseRpcPeriodMetrics,
  type PeriodMetrics,
} from '@/utils/dashboardInsightsUtils';
import { netRevenueFromRpc } from '@/utils/analyticsMetrics';
import type { OrderDashboardStats, WorkflowTabCounts } from '@/types/orders';

export type DashboardCatalogKpis = {
  productCount: number;
  lowStockCount: number;
};

export type DashboardBatchPayload = {
  today: PeriodMetrics | null;
  yesterday: PeriodMetrics | null;
  week: PeriodMetrics | null;
  previousWeek: PeriodMetrics | null;
  month: PeriodMetrics | null;
  allTime: Record<string, unknown> | null;
  workflowCounts: WorkflowTabCounts | null;
  catalogKpis: DashboardCatalogKpis | null;
};

const parseCatalogKpis = (payload: Record<string, unknown>): DashboardCatalogKpis | null => {
  const raw = payload.catalog_kpis ?? payload.all_time;
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const productCount = Number(record.product_count);
  const lowStockCount = Number(record.low_stock_count);
  if (!Number.isFinite(productCount) && !Number.isFinite(lowStockCount)) return null;
  return {
    productCount: Number.isFinite(productCount) ? productCount : 0,
    lowStockCount: Number.isFinite(lowStockCount) ? lowStockCount : 0,
  };
};

const parsePeriod = (value: unknown): PeriodMetrics | null => {
  if (!value || typeof value !== 'object') return null;
  return parseRpcPeriodMetrics(value as Record<string, unknown>);
};

export const invalidateDashboardBatchCache = (ownerId: string): void => {
  cache.del(CacheKeys.dashboardBatch(ownerId));
  cache.del(CacheKeys.dashboardKpisLight(ownerId));
  cache.del(CacheKeys.dashboardWorkflowCounts(ownerId));
};

/** Lightweight dashboard KPIs — today/week + catalog counts only. */
export const fetchDashboardKpisLight = async (
  ownerId: string
): Promise<Record<string, unknown> | null> => {
  const cacheKey = CacheKeys.dashboardKpisLight(ownerId);
  const cached = cache.get<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await callSupabaseRpc<Record<string, unknown>>(
      'get_dashboard_kpis_light',
      { p_owner_id: ownerId }
    );
    if (error || !data) return null;
    cache.set(cacheKey, data, CacheTTL.ANALYTICS, CacheTTL.ANALYTICS_STALE);
    return data;
  } catch {
    return null;
  }
};

/** Workflow tab counts only — for orders UI without full statistics batch. */
export const fetchDashboardWorkflowCounts = async (
  ownerId: string
): Promise<WorkflowTabCounts | null> => {
  const cacheKey = CacheKeys.dashboardWorkflowCounts(ownerId);
  const cached = cache.get<WorkflowTabCounts>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await callSupabaseRpc<WorkflowTabCounts>(
      'get_dashboard_workflow_counts',
      { p_owner_id: ownerId }
    );
    if (error || !data) return null;
    cache.set(cacheKey, data, CacheTTL.ANALYTICS, CacheTTL.ANALYTICS_STALE);
    return data;
  } catch {
    return null;
  }
};

export const fetchDashboardStatisticsBatch = async (
  ownerId: string
): Promise<DashboardBatchPayload | null> => {
  const cacheKey = CacheKeys.dashboardBatch(ownerId);
  const cached = cache.get<DashboardBatchPayload>(cacheKey);
  if (cached) return cached;

  return dedup(cacheKey, async () => {
    try {
      const { data, error } = await callSupabaseRpc<Record<string, unknown>>(
        'get_dashboard_statistics_batch',
        { p_owner_id: ownerId }
      );

      if (error || !data) {
        return null;
      }

      const payload = data;
      const result: DashboardBatchPayload = {
        today: parsePeriod(payload.today),
        yesterday: parsePeriod(payload.yesterday),
        week: parsePeriod(payload.week),
        previousWeek: parsePeriod(payload.previous_week),
        month: parsePeriod(payload.month),
        allTime: (payload.all_time as Record<string, unknown>) ?? null,
        workflowCounts: (payload.workflow_counts as WorkflowTabCounts) ?? null,
        catalogKpis: parseCatalogKpis(payload),
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
    const { data, error } = await callSupabaseRpc<Record<string, unknown>>('get_store_statistics', {
      p_owner_id: ownerId,
      p_start: start,
      p_end: end,
    });
    if (error || !data) return null;
    return parseRpcPeriodMetrics(data);
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
