import {
  ordersTable,
  rpcListMerchantOrders,
  rpcCountMerchantOrdersByWorkflow,
} from '@/repositories/orders/orderRepository';
import { productsTable } from '@/repositories/products/productRepository';
import { callReadRpc } from '@/lib/readWrite/readClient';
import { Order } from '@/types';
import { mapDbOrder } from '@/mappers/orderMapper';
import { parseJsonField } from '@/mappers/productMapper';
import type { ColorOption } from '@/types';
import { mapOrderError } from '@/utils/orderErrors';
import { computeOrderStats, normalizeOrderPhone, normalizeWorkflowTabCounts, type OrderListFilters, type OrderWorkflowTab } from '@/utils/orderWorkflowUtils';
import { DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';
import { filtersToRpcParams, filtersToRpcParamsWithoutWorkflow, serializeOrderFilters } from '@/utils/orderQueryBuilder';
import { cache, CacheKeys, CacheTTL, dedup } from '@/lib/cache';
import { instrumentAsync, instrumentQuery, logger, metrics } from '@/lib/observability';
import { escapeIlikePattern, sanitizePostgrestFilterValue } from '@/lib/security/postgrestFilter';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import type { OrderDashboardStats, WorkflowTabCounts } from '@/types/orders';
import {
  buildOrderDashboardStatsFromBatch,
  fetchDashboardStatisticsBatch,
} from '@/services/dashboardStatsService';
import type { DashboardBatchPayload } from '@/services/dashboardStatsService';

export const ORDERS_PER_PAGE = 50;

export const ORDER_LIST_SELECT =
  'id, status, total_amount, created_at, customer_name, customer_phone, customer_address, customer_governorate, notes, delivery_fee, delivery_status, payment_method, payment_status, coupon_code, discount_amount, order_items(id, product_id, product_name, product_price, quantity, subtotal, variant_metadata)';

const parseProductColors = (value: unknown): ColorOption[] | undefined => {
  const parsed = parseJsonField<Array<Record<string, unknown>>>(value);
  if (!parsed?.length) return undefined;
  const colors = parsed
    .map((entry) => ({
      name: entry.name != null ? String(entry.name) : undefined,
      value: String(entry.value ?? entry.hex ?? entry.name ?? '').trim(),
      image: entry.image != null ? String(entry.image) : undefined,
    }))
    .filter((entry) => entry.value);
  return colors.length ? colors : undefined;
};

const enrichOrdersWithProductImages = async (
  orders: Order[],
  ownerId: string,
  options?: { skip?: boolean }
): Promise<Order[]> => {
  if (options?.skip || orders.length === 0) return orders;

  const needsEnrichment = orders.some((order) =>
    order.items.some(
      (item) =>
        item.product.id &&
        (!item.product.image || (item.selectedColor && !item.product.colors?.length))
    )
  );
  if (!needsEnrichment) return orders;

  const productIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.items.filter((item) => item.product.id).map((item) => item.product.id)
      )
    ),
  ];

  if (productIds.length === 0) return orders;

  const { data, error } = await productsTable()
    .select('id, image_url, colors')
    .eq('owner_id', ownerId)
    .in('id', productIds);

  if (error || !data?.length) return orders;

  const catalogByProductId = new Map(
    data.map((row) => [
      String(row.id),
      {
        image: String(row.image_url || ''),
        colors: parseProductColors(row.colors),
      },
    ])
  );

  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => {
      const catalog = catalogByProductId.get(item.product.id);
      const image =
        item.product.image || catalog?.image || '/placeholder.svg';
      return {
        ...item,
        product: {
          ...item.product,
          image,
          colors: item.product.colors?.length ? item.product.colors : catalog?.colors,
        },
      };
    }),
  }));
};

export const fetchOrdersPage = async (
  ownerId: string,
  page = 0,
  pageSize = ORDERS_PER_PAGE
): Promise<Order[]> => {
  await assertMerchantOwner(ownerId);
  const result = await fetchOrdersFiltered(ownerId, DEFAULT_LIST_FILTERS, page, pageSize);
  return result.orders;
};

const DEFAULT_LIST_FILTERS: OrderListFilters = {
  search: '',
  workflowTab: 'new',
  orderStatus: 'all',
  paymentStatus: 'all',
  deliveryStatus: 'all',
  datePreset: 'all',
};

const RECENT_ORDERS_FILTERS: OrderListFilters = {
  ...DEFAULT_LIST_FILTERS,
  workflowTab: 'new',
};

const applyWorkflowTabFilter = (
  query: ReturnType<typeof ordersTable>,
  workflowTab: OrderWorkflowTab
) => {
  if (workflowTab === 'new') return query.eq('status', 'pending');
  if (workflowTab === 'completed') return query.eq('status', 'completed');
  if (workflowTab === 'cancelled') return query.eq('status', 'cancelled');
  return query;
};

export type OrdersPageResult = {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  nextCursor?: string | null;
};

const mapRpcOrderRows = (
  rows: unknown[],
  ownerId: string,
  options?: { skipImageEnrichment?: boolean }
): Promise<Order[]> => {
  const mapped = rows.map((row) => mapDbOrder(row as Record<string, unknown>));
  return enrichOrdersWithProductImages(mapped, ownerId, { skip: options?.skipImageEnrichment });
};

/** Server-side filtered order list with exact total count (RPC + fallback). */
export const fetchOrdersFiltered = async (
  ownerId: string,
  filters: OrderListFilters,
  page = 0,
  pageSize = ORDERS_PER_PAGE,
  cursor?: string | null
): Promise<OrdersPageResult> => {
  await assertMerchantOwner(ownerId);
  return instrumentAsync('orders.fetchFiltered', async () => {
    const filterKey = serializeOrderFilters(filters);
    const cacheKey = CacheKeys.ordersFiltered(ownerId, filterKey, page, cursor ?? '');
    const cached = cache.get<OrdersPageResult>(cacheKey);
    if (cached) return cached;

    const rpcParams = {
      p_owner_id: ownerId,
      ...filtersToRpcParams(filters, page, pageSize, cursor),
    };

    const { data, error } = await callReadRpc<{
      orders?: unknown[];
      total?: number;
      next_cursor?: string | null;
    }>('list_merchant_orders', rpcParams);

    if (!error && data?.orders) {
      const orders = await mapRpcOrderRows(data.orders as unknown[], ownerId);
      let total = data.total != null ? Number(data.total) : undefined;
      if (total == null && cursor) {
        const page0 = cache.get<OrdersPageResult>(
          CacheKeys.ordersFiltered(ownerId, filterKey, 0, '')
        );
        if (page0) total = page0.total;
      }
      total = total ?? 0;
      const result: OrdersPageResult = {
        orders,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        nextCursor: data.next_cursor ?? null,
      };
      cache.set(cacheKey, result, CacheTTL.SHORT, CacheTTL.STALE);
      return result;
    }

    if (error) {
      logger.warn('orders.fetchFiltered.rpc_fallback', { message: error });
    }

    return fetchOrdersFilteredFallback(ownerId, filters, page, pageSize, filterKey);
  }, { ownerId, page, pageSize, cursor: cursor ?? null });
};

const fetchOrdersFilteredFallback = async (
  ownerId: string,
  filters: OrderListFilters,
  page: number,
  pageSize: number,
  filterKey: string
): Promise<OrdersPageResult> => {
  let query = ordersTable()
    .select(ORDER_LIST_SELECT, { count: 'exact' })
    .eq('owner_id', ownerId);

  query = applyWorkflowTabFilter(query, filters.workflowTab);

  if (filters.orderStatus !== 'all') query = query.eq('status', filters.orderStatus);
  if (filters.paymentStatus !== 'all') query = query.eq('payment_status', filters.paymentStatus);
  if (filters.deliveryStatus !== 'all') query = query.eq('delivery_status', filters.deliveryStatus);
  if (filters.minValue != null) query = query.gte('total_amount', filters.minValue);
  if (filters.maxValue != null) query = query.lte('total_amount', filters.maxValue);

  const { getDateRangeForPreset } = await import('@/utils/orderQueryBuilder');
  const range = getDateRangeForPreset(filters.datePreset);
  if (range.from) query = query.gte('created_at', range.from);
  if (range.to) query = query.lte('created_at', range.to);

  const search = filters.search.trim();
  if (search) {
    const safe = escapeIlikePattern(search);
    const pattern = `%${safe.replace(/-/g, '')}%`;
    query = query.or(
      `customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%,id.ilike.${pattern}`
    );
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    logger.error('orders.fetchFiltered.fallback failed', { message: error.message });
    return { orders: [], total: 0, page, pageSize, totalPages: 1 };
  }

  const orders = await mapRpcOrderRows(
    (data ?? []).map((row) => row as Record<string, unknown>),
    ownerId
  );
  const total = count ?? orders.length;

  const result: OrdersPageResult = {
    orders,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
  cache.set(CacheKeys.ordersFiltered(ownerId, filterKey, page), result, CacheTTL.SHORT, CacheTTL.STALE);
  return result;
};

const EMPTY_WORKFLOW_COUNTS: WorkflowTabCounts = {
  new: 0,
  completed: 0,
  cancelled: 0,
};

export const fetchWorkflowTabCounts = async (
  ownerId: string,
  filters: OrderListFilters
): Promise<WorkflowTabCounts> => {
  await assertMerchantOwner(ownerId);
  const baseKey = serializeOrderFilters({ ...filters, workflowTab: 'new' });
  const cacheKey = CacheKeys.ordersWorkflowCounts(ownerId, baseKey);
  const cached = cache.get<WorkflowTabCounts>(cacheKey);
  if (cached) return cached;

  const defaultKey = serializeOrderFilters({ ...DEFAULT_ORDER_FILTERS, workflowTab: 'new' });
  if (baseKey === defaultKey) {
    const batch = cache.get<DashboardBatchPayload>(CacheKeys.dashboardBatch(ownerId));
    if (batch?.workflowCounts) {
      cache.set(cacheKey, batch.workflowCounts, CacheTTL.SHORT, CacheTTL.STALE);
      return batch.workflowCounts;
    }
  }

  const params = {
    p_owner_id: ownerId,
    ...filtersToRpcParamsWithoutWorkflow(filters),
  };

  const { data, error } = await rpcCountMerchantOrdersByWorkflow(params);

  if (!error && data) {
    const counts = normalizeWorkflowTabCounts(data as Record<string, number>);
    cache.set(cacheKey, counts, CacheTTL.SHORT, CacheTTL.STALE);
    return counts;
  }

  const { filterOrdersList, countOrdersByWorkflowTab } = await import('@/utils/orderWorkflowUtils');
  const { getDateRangeForPreset } = await import('@/utils/orderQueryBuilder');

  let query = ordersTable()
    .select(ORDER_LIST_SELECT)
    .eq('owner_id', ownerId);

  if (filters.orderStatus !== 'all') query = query.eq('status', filters.orderStatus);
  if (filters.paymentStatus !== 'all') query = query.eq('payment_status', filters.paymentStatus);
  if (filters.deliveryStatus !== 'all') query = query.eq('delivery_status', filters.deliveryStatus);
  if (filters.minValue != null) query = query.gte('total_amount', filters.minValue);
  if (filters.maxValue != null) query = query.lte('total_amount', filters.maxValue);

  const range = getDateRangeForPreset(filters.datePreset);
  if (range.from) query = query.gte('created_at', range.from);
  if (range.to) query = query.lte('created_at', range.to);

  const search = filters.search.trim();
  if (search) {
    const safe = escapeIlikePattern(search);
    const pattern = `%${safe.replace(/-/g, '')}%`;
    query = query.or(
      `customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%,id.ilike.${pattern}`
    );
  }

  const { data: fallbackRows, error: fallbackError } = await query
    .order('created_at', { ascending: false })
    .range(0, ORDERS_STATS_CAP - 1);

  if (fallbackError || !fallbackRows) {
    logger.warn('orders.workflowCounts.fallback failed', { message: fallbackError?.message });
    return EMPTY_WORKFLOW_COUNTS;
  }

  const allMapped = fallbackRows.map((row) => mapDbOrder(row as Record<string, unknown>));
  const baseFiltered = filterOrdersList(allMapped, filters, { skipWorkflow: true });
  const counts = countOrdersByWorkflowTab(baseFiltered);
  cache.set(cacheKey, counts, CacheTTL.SHORT, CacheTTL.STALE);
  return counts;
};

export const fetchRecentOrders = async (ownerId: string, limit = 5): Promise<Order[]> => {
  await assertMerchantOwner(ownerId);
  const cacheKey = CacheKeys.ordersRecent(ownerId);
  const cached = cache.get<Order[]>(cacheKey);
  if (cached) return cached.filter((order) => order.status === 'pending');

  const { data, error } = await rpcListMerchantOrders({
    p_owner_id: ownerId,
    ...filtersToRpcParams(RECENT_ORDERS_FILTERS, 0, limit),
  });

  if (!error && data?.orders) {
    const mapped = (data.orders as unknown[]).map((row) =>
      mapDbOrder(row as Record<string, unknown>)
    );
    const newOrders = mapped.filter((order) => order.status === 'pending');
    const enriched = await enrichOrdersWithProductImages(newOrders, ownerId, { skip: true });
    cache.set(cacheKey, enriched, CacheTTL.MEDIUM, CacheTTL.STALE);
    return enriched;
  }

  const { data: rows, error: queryError } = await ordersTable()
    .select(ORDER_LIST_SELECT)
    .eq('owner_id', ownerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (queryError || !rows) return [];

  const mapped = rows.map((row) => mapDbOrder(row as Record<string, unknown>));
  const enriched = await enrichOrdersWithProductImages(mapped, ownerId, { skip: true });
  cache.set(cacheKey, enriched, CacheTTL.MEDIUM, CacheTTL.STALE);
  return enriched;
};

/** @deprecated Use fetchOrdersFiltered for paginated lists */
export const fetchOrdersPageLegacy = async (
  ownerId: string,
  page = 0,
  pageSize = ORDERS_PER_PAGE
): Promise<Order[]> => {
  return instrumentAsync('orders.fetchPage', async () => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await ordersTable()
      .select(ORDER_LIST_SELECT)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('orders.fetchPage failed', { ownerId, page, message: error.message });
      return [];
    }
    if (!data) return [];
    const mapped = data.map((row) => mapDbOrder(row as Record<string, unknown>));
    return enrichOrdersWithProductImages(mapped, ownerId);
  }, { ownerId, page, pageSize });
};

export const ORDERS_STATS_CAP = 5000;

export const ORDER_STATS_SELECT =
  'id, status, total_amount, payment_status, delivery_status, created_at';

export type { OrderDashboardStats, WorkflowTabCounts } from '@/types/orders';

export type CustomerOrderInsights = {
  orderCount: number;
  totalSpent: number;
};

/** Customer history by phone (same store, tenant-isolated). Uses indexed phone lookup. */
export const fetchCustomerInsightsByPhone = async (
  ownerId: string,
  phone: string
): Promise<CustomerOrderInsights> => {
  await assertMerchantOwner(ownerId);
  const digits = normalizeOrderPhone(phone);
  if (!digits) return { orderCount: 0, totalSpent: 0 };

  const safePhone = sanitizePostgrestFilterValue(phone);
  const safeDigits = sanitizePostgrestFilterValue(digits);

  const { data, error } = await ordersTable()
    .select('total_amount, status, customer_phone')
    .eq('owner_id', ownerId)
    .neq('status', 'cancelled')
    .or(`customer_phone.eq.${safePhone},customer_phone.ilike.%${safeDigits}%`)
    .limit(200);

  if (error || !data) return { orderCount: 0, totalSpent: 0 };

  const matched = data.filter(
    (row) => normalizeOrderPhone(String(row.customer_phone ?? '')) === digits
  );

  return {
    orderCount: matched.length,
    totalSpent: matched.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0),
  };
};

/** Lightweight order rows for period metrics fallback (not paginated list). */
export const fetchOrderStatsRows = async (ownerId: string): Promise<Order[]> => {
  await assertMerchantOwner(ownerId);
  const cacheKey = CacheKeys.ordersStatsSummary(ownerId) + ':rows';
  const cached = cache.get<Order[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await ordersTable()
    .select(ORDER_STATS_SELECT)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(ORDERS_STATS_CAP);

  if (error || !data) return [];

  const orders: Order[] = data.map((row) => ({
    id: String(row.id),
    status: row.status as Order['status'],
    total: Number(row.total_amount ?? 0),
    paymentStatus: row.payment_status ?? undefined,
    deliveryStatus: row.delivery_status ?? undefined,
    date: String(row.created_at),
    customerInfo: { name: '', phone: '', address: '' },
    items: [],
  }));

  cache.set(cacheKey, orders, CacheTTL.SHORT, CacheTTL.STALE);
  return orders;
};

const buildOrderStatsFromRpc = async (ownerId: string): Promise<OrderDashboardStats | null> => {
  const batch = await fetchDashboardStatisticsBatch(ownerId);
  if (!batch) return null;
  return buildOrderDashboardStatsFromBatch(batch);
};

/** Aggregate order stats across the full store (not paginated list). */
export const fetchOrderStatsSummary = async (ownerId: string): Promise<OrderDashboardStats> => {
  await assertMerchantOwner(ownerId);
  const cacheKey = CacheKeys.ordersStatsSummary(ownerId);
  const cached = cache.get<OrderDashboardStats>(cacheKey);
  if (cached) return cached;

  return dedup(`orders-stats-${ownerId}`, async () => {
    const stats = await instrumentAsync('orders.statsSummary', async () => {
      const fromRpc = await buildOrderStatsFromRpc(ownerId);
      if (fromRpc) return fromRpc;

      const orders = await fetchOrderStatsRows(ownerId);
      return computeOrderStats(orders);
    }, { ownerId });

    cache.set(cacheKey, stats, CacheTTL.SHORT, CacheTTL.STALE);
    return stats;
  });
};

