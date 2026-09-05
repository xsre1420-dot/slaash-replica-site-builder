import { callReadRpc } from '@/lib/readWrite/readClient';
import {
  hasDashboardKpisLightRpc,
  hasDashboardWorkflowCountsRpc,
} from '@/lib/supabase/schemaCapabilities';
import { scheduleMerchantAnalyticsFlush } from '@/lib/analytics/analyticsFlushQueue';
import {
  fetchDashboardBatchCached,
  fetchDashboardKpisLightCached,
  fetchDashboardWorkflowCountsCached,
  invalidateDashboardCaches,
} from '@/lib/cache/dashboardCacheLayer';
import {
  parseRpcPeriodMetrics,
  type PeriodMetrics,
} from '@/utils/dashboardInsightsUtils';
import { netRevenueFromRpc } from '@/utils/analyticsMetrics';
import type { OrderDashboardStats, WorkflowTabCounts } from '@/types/orders';
import { normalizeWorkflowTabCounts } from '@/utils/orderWorkflowUtils';
import { traceCriticalFlow } from '@/lib/tracing';

export type DashboardCatalogKpis = {
  /** All non-archived products (drafts + published). */
  productCount: number;
  /** Published storefront-visible products. */
  publishedCount: number;
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
  const publishedCount = Number(record.published_count ?? record.published_product_count);
  const lowStockCount = Number(record.low_stock_count);
  if (
    !Number.isFinite(productCount) &&
    !Number.isFinite(publishedCount) &&
    !Number.isFinite(lowStockCount)
  ) {
    return null;
  }
  const published = Number.isFinite(publishedCount)
    ? publishedCount
    : Number.isFinite(productCount)
      ? productCount
      : 0;
  const total = Number.isFinite(productCount) ? productCount : published;
  return {
    productCount: Math.max(total, published),
    publishedCount: published,
    lowStockCount: Number.isFinite(lowStockCount) ? lowStockCount : 0,
  };
};

const parsePeriod = (value: unknown): PeriodMetrics | null => {
  if (!value || typeof value !== 'object') return null;
  return parseRpcPeriodMetrics(value as Record<string, unknown>);
};

export const invalidateDashboardBatchCache = (ownerId: string): void => {
  invalidateDashboardCaches(ownerId);
};

async function fetchDashboardStatisticsBatchRaw(
  ownerId: string
): Promise<DashboardBatchPayload | null> {
  try {
    scheduleMerchantAnalyticsFlush(ownerId);
    const { data, error } = await callReadRpc<Record<string, unknown>>(
      'get_dashboard_statistics_batch',
      { p_owner_id: ownerId }
    );
    if (error || !data) return null;

    return {
      today: parsePeriod(data.today),
      yesterday: parsePeriod(data.yesterday),
      week: parsePeriod(data.week),
      previousWeek: parsePeriod(data.previous_week),
      month: parsePeriod(data.month),
      allTime: (data.all_time as Record<string, unknown>) ?? null,
      workflowCounts: normalizeWorkflowTabCounts(
        data.workflow_counts as Record<string, number> | null
      ),
      catalogKpis: parseCatalogKpis(data),
    };
  } catch {
    return null;
  }
}

/** Lightweight dashboard KPIs — today/week + catalog counts only. */
export const fetchDashboardKpisLight = async (
  ownerId: string
): Promise<Record<string, unknown> | null> => {
  return fetchDashboardKpisLightCached(ownerId, async () => {
    if (await hasDashboardKpisLightRpc()) {
      try {
        const { data, error } = await callReadRpc<Record<string, unknown>>(
          'get_dashboard_kpis_light',
          { p_owner_id: ownerId }
        );
        if (!error && data) return data;
      } catch {
        /* fall through to batch-derived payload */
      }
    }

    const batch = await fetchDashboardStatisticsBatchRaw(ownerId);
    if (!batch) return null;

    return {
      today: batch.today,
      week: batch.week,
      catalog_kpis: batch.catalogKpis ?? batch.allTime,
    };
  });
};

/** Workflow tab counts only — for orders UI without full statistics batch. */
export const fetchDashboardWorkflowCounts = async (
  ownerId: string
): Promise<WorkflowTabCounts | null> => {
  return fetchDashboardWorkflowCountsCached(ownerId, async () => {
    if (await hasDashboardWorkflowCountsRpc()) {
      try {
        const { data, error } = await callReadRpc<WorkflowTabCounts>(
          'get_dashboard_workflow_counts',
          { p_owner_id: ownerId }
        );
        if (!error && data) return data;
      } catch {
        /* fall through to batch-derived counts */
      }
    }

    const batch = await fetchDashboardStatisticsBatchRaw(ownerId);
    return batch?.workflowCounts ?? null;
  });
};

export const fetchDashboardStatisticsBatch = async (
  ownerId: string
): Promise<DashboardBatchPayload | null> => {
  const statsStarted = performance.now();
  return traceCriticalFlow('dashboard.load', 'rpc', 'statisticsBatch', async () =>
    fetchDashboardBatchCached(ownerId, async () => {
    const batch = await fetchDashboardStatisticsBatchRaw(ownerId);
    if (batch) {
      void import('@/lib/monitoring/instrumentation').then(({ recordDashboardStatsFetch }) => {
        recordDashboardStatsFetch(Date.now() - statsStarted);
      });
    }
    return batch;
  })
  , { ownerId });
};

/** Single-period KPI fetch — used when dashboard batch RPC is unavailable. */
export const fetchStoreStatisticsPeriod = async (
  ownerId: string,
  start: string,
  end: string
): Promise<PeriodMetrics | null> => {
  try {
    const { data, error } = await callReadRpc<Record<string, unknown>>('get_store_statistics', {
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
  const counts = normalizeWorkflowTabCounts(batch.workflowCounts as Record<string, number> | null);
  const month = batch.month;
  const today = batch.today;
  const week = batch.week;
  const allTime = batch.allTime;

  const totalRevenue = netRevenueFromRpc(allTime) || month?.revenue || 0;
  const completedCount = counts.completed;

  return {
    total: counts.new + counts.completed + counts.cancelled || month?.orders || 0,
    newOrders: counts.new,
    pendingFulfillment: counts.new,
    delivered: completedCount,
    revenue: totalRevenue,
    todayRevenue: today?.revenue ?? 0,
    weekRevenue: week?.revenue ?? 0,
    monthRevenue: month?.revenue ?? 0,
    pendingRevenue: 0,
    avgOrderValue: completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0,
    todayOrders: today?.orders ?? 0,
    weekOrders: week?.orders ?? 0,
    monthOrders: month?.orders ?? 0,
  };
};
