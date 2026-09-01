/**
 * Orders page bundle — one coordinated load for list + tab counts + dashboard stats.
 */
import { Order } from '@/types';
import type { OrderDashboardStats, WorkflowTabCounts } from '@/types/orders';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import {
  fetchOrdersFiltered,
  fetchWorkflowTabCounts,
  fetchOrderStatsSummary,
  ORDERS_PER_PAGE,
} from '@/services/orderService';
import {
  buildOrderDashboardStatsFromBatch,
  fetchDashboardStatisticsBatch,
  type DashboardBatchPayload,
} from '@/services/dashboardStatsService';
import {
  DEFAULT_ORDER_FILTERS,
  type OrderListFilters,
} from '@/utils/orderWorkflowUtils';
import { serializeOrderFilters } from '@/utils/orderQueryBuilder';

export type OrdersPageBundle = {
  orders: Order[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  nextCursor: string | null;
  tabCounts: WorkflowTabCounts;
  stats: OrderDashboardStats;
  filterKey: string;
};

const EMPTY_STATS: OrderDashboardStats = {
  total: 0,
  newOrders: 0,
  pendingFulfillment: 0,
  delivered: 0,
  revenue: 0,
  todayRevenue: 0,
  weekRevenue: 0,
  monthRevenue: 0,
  pendingRevenue: 0,
  avgOrderValue: 0,
  todayOrders: 0,
  weekOrders: 0,
  monthOrders: 0,
};

const workflowCountsBaseKey = (filters: OrderListFilters): string =>
  serializeOrderFilters({ ...filters, workflowTab: 'new' });

const isUnfilteredWorkflowCounts = (filters: OrderListFilters): boolean =>
  workflowCountsBaseKey(filters) ===
  serializeOrderFilters({ ...DEFAULT_ORDER_FILTERS, workflowTab: 'new' });

async function resolveTabCounts(
  ownerId: string,
  filters: OrderListFilters,
  batch: DashboardBatchPayload | null
): Promise<WorkflowTabCounts> {
  if (isUnfilteredWorkflowCounts(filters) && batch?.workflowCounts) {
    const baseKey = workflowCountsBaseKey(filters);
    cache.set(
      CacheKeys.ordersWorkflowCounts(ownerId, baseKey),
      batch.workflowCounts,
      CacheTTL.SHORT,
      CacheTTL.STALE
    );
    return batch.workflowCounts;
  }
  return fetchWorkflowTabCounts(ownerId, filters);
}

async function resolveStats(
  ownerId: string,
  batch: DashboardBatchPayload | null
): Promise<OrderDashboardStats> {
  if (batch) {
    const stats = buildOrderDashboardStatsFromBatch(batch);
    cache.set(CacheKeys.ordersStatsSummary(ownerId), stats, CacheTTL.SHORT, CacheTTL.STALE);
    return stats;
  }
  try {
    return await fetchOrderStatsSummary(ownerId);
  } catch {
    return EMPTY_STATS;
  }
}

export function peekOrdersPageBundle(
  ownerId: string,
  filters: OrderListFilters,
  page = 0
): OrdersPageBundle | null {
  const filterKey = serializeOrderFilters(filters);
  return cache.get<OrdersPageBundle>(CacheKeys.ordersPage(ownerId, filterKey, page));
}

export function invalidateOrdersPageBundle(
  ownerId: string,
  filterKey?: string,
  page?: number
): void {
  if (filterKey != null && page != null) {
    const key = CacheKeys.ordersPage(ownerId, filterKey, page);
    cache.del(key);
    clearInflight(key);
    return;
  }
  cache.flushByPrefix(`orders-page:${ownerId}:`);
}

/** Single deduped entry: orders list + workflow counts + revenue stats. */
export async function loadOrdersPageBundle(
  ownerId: string,
  filters: OrderListFilters,
  page = 0,
  options?: { force?: boolean }
): Promise<OrdersPageBundle> {
  const filterKey = serializeOrderFilters(filters);
  const key = CacheKeys.ordersPage(ownerId, filterKey, page);

  if (!options?.force) {
    const peek = peekOrdersPageBundle(ownerId, filters, page);
    if (peek) return peek;
  } else {
    invalidateOrdersPageBundle(ownerId, filterKey, page);
  }

  return dedup(key, async () => {
    const batchPromise = fetchDashboardStatisticsBatch(ownerId);
    const ordersPromise = fetchOrdersFiltered(ownerId, filters, page, ORDERS_PER_PAGE);

    const [ordersResult, batch] = await Promise.all([ordersPromise, batchPromise]);

    const [tabCounts, stats] = await Promise.all([
      resolveTabCounts(ownerId, filters, batch),
      resolveStats(ownerId, batch),
    ]);

    const bundle: OrdersPageBundle = {
      orders: ordersResult.orders,
      total: ordersResult.total,
      totalPages: ordersResult.totalPages,
      page: ordersResult.page,
      pageSize: ordersResult.pageSize,
      nextCursor: ordersResult.nextCursor ?? null,
      tabCounts,
      stats,
      filterKey,
    };

    cache.set(key, bundle, CacheTTL.SHORT, CacheTTL.STALE);
    return bundle;
  });
}
