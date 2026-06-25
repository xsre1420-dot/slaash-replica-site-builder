import { supabase } from '@/integrations/supabase/client';
import { Order, CartItem } from '@/types';
import { mapDbOrder } from '@/mappers/orderMapper';
import { getOrCreateIdempotencyKey } from '@/utils/checkoutSession';
import { tryRecoverCheckoutOrder } from '@/services/checkoutRecoveryService';
import { mapOrderRpcFailure, mapOrderError } from '@/utils/orderErrors';
import { computeOrderStats, normalizeOrderPhone, type OrderListFilters, type OrderWorkflowTab } from '@/utils/orderWorkflowUtils';
import { DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';
import { filtersToRpcParams, filtersToRpcParamsWithoutWorkflow, serializeOrderFilters } from '@/utils/orderQueryBuilder';
import { cache, CacheKeys, CacheTTL, dedup, flushOrderCache } from '@/lib/cache';
import { instrumentAsync, instrumentQuery, logger, metrics } from '@/lib/observability';
import { recordHealthEvent } from '@/lib/observability/healthMonitor';
import {
  enforceRateLimit,
  formatRateLimitMessageAr,
  RATE_LIMITS,
  RateLimitExceededError,
} from '@/lib/security/rateLimiter';
import type { MarketingAttribution } from '@/lib/attribution';
import { escapeIlikePattern, sanitizePostgrestFilterValue } from '@/lib/security/postgrestFilter';
import { invalidateStorefrontScope } from '@/services/storefrontProductService';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import type { OrderDashboardStats, WorkflowTabCounts } from '@/types/orders';
import {
  buildOrderDashboardStatsFromBatch,
  fetchDashboardStatisticsBatch,
} from '@/services/dashboardStatsService';

export const ORDERS_PER_PAGE = 50;

export const ORDER_DETAIL_SELECT =
  'id, status, total_amount, created_at, customer_name, customer_phone, customer_address, customer_governorate, notes, coupon_code, discount_amount, payment_method, payment_status, delivery_fee, delivery_status, order_items(id, product_id, product_name, product_price, quantity, subtotal, variant_metadata)';

export const ORDER_LIST_SELECT =
  'id, status, total_amount, created_at, updated_at, customer_name, customer_phone, customer_address, customer_governorate, notes, delivery_fee, delivery_status, payment_method, payment_status, coupon_code, discount_amount, order_items(id, product_id)';

const enrichOrdersWithProductImages = async (
  orders: Order[],
  ownerId: string,
  options?: { skip?: boolean }
): Promise<Order[]> => {
  if (options?.skip || orders.length === 0) return orders;

  const productIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.items.map((item) => item.product.id).filter(Boolean)
      )
    ),
  ];

  if (productIds.length === 0) return orders;

  const { data, error } = await supabase
    .from('products')
    .select('id, image_url')
    .eq('owner_id', ownerId)
    .in('id', productIds);

  if (error || !data?.length) return orders;

  const imageByProductId = new Map(
    data.map((row) => [String(row.id), String(row.image_url || '')])
  );

  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => {
      const image =
        item.product.image ||
        imageByProductId.get(item.product.id) ||
        '/placeholder.svg';
      return {
        ...item,
        product: { ...item.product, image },
      };
    }),
  }));
};

export const fetchOrderById = async (
  orderId: string,
  ownerId: string
): Promise<Order | null> => {
  await assertMerchantOwner(ownerId);
  return instrumentQuery(
    'orders.fetchById',
    async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_DETAIL_SELECT)
        .eq('id', orderId)
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (error) return { data: null, error };
      if (!data) return { data: null, error: null };
      const mapped = mapDbOrder(data as Record<string, unknown>);
      const [enriched] = await enrichOrdersWithProductImages([mapped], ownerId);
      return { data: enriched ?? null, error: null };

    },
    { orderId, ownerId }
  );
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
  workflowTab: 'all',
  orderStatus: 'all',
  paymentStatus: 'all',
  deliveryStatus: 'all',
  datePreset: 'all',
};

export type OrdersPageResult = {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const mapRpcOrderRows = (rows: unknown[], ownerId: string): Promise<Order[]> => {
  const mapped = rows.map((row) => mapDbOrder(row as Record<string, unknown>));
  return enrichOrdersWithProductImages(mapped, ownerId);
};

/** Server-side filtered order list with exact total count (RPC + fallback). */
export const fetchOrdersFiltered = async (
  ownerId: string,
  filters: OrderListFilters,
  page = 0,
  pageSize = ORDERS_PER_PAGE
): Promise<OrdersPageResult> => {
  await assertMerchantOwner(ownerId);
  return instrumentAsync('orders.fetchFiltered', async () => {
    const filterKey = serializeOrderFilters(filters);
    const cacheKey = CacheKeys.ordersFiltered(ownerId, filterKey, page);
    const cached = cache.get<OrdersPageResult>(cacheKey);
    if (cached) return cached;

    const rpcParams = {
      p_owner_id: ownerId,
      ...filtersToRpcParams(filters, page, pageSize),
    };

    const { data, error } = await (supabase as any).rpc('list_merchant_orders', rpcParams);

    if (!error && data?.orders) {
      const orders = await mapRpcOrderRows(data.orders as unknown[], ownerId);
      const total = Number(data.total ?? 0);
      const result: OrdersPageResult = {
        orders,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
      cache.set(cacheKey, result, CacheTTL.SHORT, CacheTTL.STALE);
      return result;
    }

    if (error) {
      logger.warn('orders.fetchFiltered.rpc_fallback', { message: error.message });
    }

    return fetchOrdersFilteredFallback(ownerId, filters, page, pageSize, filterKey);
  }, { ownerId, page, pageSize });
};

const fetchOrdersFilteredFallback = async (
  ownerId: string,
  filters: OrderListFilters,
  page: number,
  pageSize: number,
  filterKey: string
): Promise<OrdersPageResult> => {
  if (filters.workflowTab !== 'all') {
    logger.warn('orders.fetchFiltered.fallback_unsupported', { workflowTab: filters.workflowTab });
    return { orders: [], total: 0, page, pageSize, totalPages: 1 };
  }

  let query = supabase
    .from('orders')
    .select(ORDER_LIST_SELECT, { count: 'exact' })
    .eq('owner_id', ownerId);

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
  all: 0,
  new: 0,
  processing: 0,
  paid: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
  refunded: 0,
};

export const fetchWorkflowTabCounts = async (
  ownerId: string,
  filters: OrderListFilters
): Promise<WorkflowTabCounts> => {
  await assertMerchantOwner(ownerId);
  const baseKey = serializeOrderFilters({ ...filters, workflowTab: 'all' });
  const cacheKey = CacheKeys.ordersWorkflowCounts(ownerId, baseKey);
  const cached = cache.get<WorkflowTabCounts>(cacheKey);
  if (cached) return cached;

  const params = {
    p_owner_id: ownerId,
    ...filtersToRpcParamsWithoutWorkflow(filters),
  };

  const { data, error } = await (supabase as any).rpc('count_merchant_orders_by_workflow', params);

  if (!error && data) {
    const counts = data as WorkflowTabCounts;
    cache.set(cacheKey, counts, CacheTTL.SHORT, CacheTTL.STALE);
    return counts;
  }

  const { filterOrdersList, countOrdersByWorkflowTab } = await import('@/utils/orderWorkflowUtils');
  const { getDateRangeForPreset } = await import('@/utils/orderQueryBuilder');

  let query = supabase
    .from('orders')
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

  const allMapped = await mapRpcOrderRows(
    fallbackRows.map((row) => row as Record<string, unknown>),
    ownerId
  );
  const baseFiltered = filterOrdersList(allMapped, { ...filters, workflowTab: 'all' });
  const counts = countOrdersByWorkflowTab(baseFiltered);
  cache.set(cacheKey, counts, CacheTTL.SHORT, CacheTTL.STALE);
  return counts;
};

export const fetchRecentOrders = async (ownerId: string, limit = 5): Promise<Order[]> => {
  await assertMerchantOwner(ownerId);
  const cacheKey = CacheKeys.ordersRecent(ownerId);
  const cached = cache.get<Order[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await (supabase as any).rpc('list_merchant_orders', {
    p_owner_id: ownerId,
    ...filtersToRpcParams(DEFAULT_ORDER_FILTERS, 0, limit),
  });

  if (!error && data?.orders) {
    const mapped = (data.orders as unknown[]).map((row) =>
      mapDbOrder(row as Record<string, unknown>)
    );
    const enriched = await enrichOrdersWithProductImages(mapped, ownerId, { skip: true });
    cache.set(cacheKey, enriched, CacheTTL.MEDIUM, CacheTTL.STALE);
    return enriched;
  }

  const { data: rows, error: queryError } = await supabase
    .from('orders')
    .select(ORDER_LIST_SELECT)
    .eq('owner_id', ownerId)
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

    const { data, error } = await supabase
      .from('orders')
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

export const updateOrderStatus = async (
  orderId: string,
  ownerId: string,
  status: Order['status']
): Promise<{ success: boolean; error?: string }> => {
  await assertMerchantOwner(ownerId);
  const started = performance.now();
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('owner_id', ownerId);

  metrics.timing('orders.updateStatus', performance.now() - started, { status });

  if (error) {
    logger.error('orders.updateStatus.failed', { orderId, ownerId, status, message: error.message });
    return { success: false, error: mapOrderError(error.message) };
  }

  metrics.increment('orders.updateStatus.success', { status });
  return { success: true };
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

  const { data, error } = await supabase
    .from('orders')
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

  const { data, error } = await supabase
    .from('orders')
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Deduplicate concurrent createOrder calls sharing the same idempotency key. */
const inflightOrders = new Map<string, Promise<CreateOrderResult>>();

/** @internal test helper */
export const clearInflightOrdersForTests = (): void => {
  inflightOrders.clear();
};

const isRetryableOrderError = (message: string): boolean => {
  const lower = message.toLowerCase();
  if (
    lower.includes('insufficient stock') ||
    lower.includes('stock_deduction_failed') ||
    lower.includes('total_amount_mismatch') ||
    lower.includes('rate_limited') ||
    message.includes('غير متوفر') ||
    message.includes('مخزون')
  ) {
    return false;
  }
  return (
    lower.includes('timeout') ||
    lower.includes('lock') ||
    lower.includes('could not be processed') ||
    lower.includes('connection') ||
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('aborted') ||
    lower.includes('econnreset') ||
    lower.includes('socket') ||
    lower.includes('temporarily unavailable')
  );
};

const buildRecoveredOrderResult = (
  order: Order,
  recovered: { orderId: string; totalAmount: number }
): CreateOrderResult => ({
  ...order,
  id: recovered.orderId,
  total: recovered.totalAmount,
  wasIdempotent: true,
});

const normalizeOrderRpcItems = (items: CartItem[]) =>
  items.map((item) => ({
    product_id: item.product.id,
    quantity: item.quantity,
    selected_size: item.selectedSize?.trim() || null,
    selected_color: item.selectedColor?.trim() || null,
  }));

export type CreateOrderResult = Order & { wasIdempotent?: boolean };

export const createOrder = async (
  order: Order,
  ownerId: string,
  paymentMethod = 'cash_on_delivery',
  couponCode?: string | null,
  storeSlug?: string | null,
  marketingAttribution?: MarketingAttribution | null
): Promise<CreateOrderResult> => {
  const idempotencyKey = getOrCreateIdempotencyKey(ownerId);
  const inflightKey = `${ownerId}:${idempotencyKey}`;
  const existing = inflightOrders.get(inflightKey);
  if (existing) return existing;

  const promise = instrumentAsync('order.create', async () => {
    try {
      enforceRateLimit(`checkout:${ownerId}`, RATE_LIMITS.checkout);
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        throw new Error(formatRateLimitMessageAr(err.retryAfterMs));
      }
      throw err;
    }

    const maxAttempts = 3;

    const orderItems = normalizeOrderRpcItems(order.items);
    let submitTotal = order.total;

    let lastError = 'Order creation failed';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await (supabase as any).rpc('create_order_with_stock_deduction', {
        p_order_id: order.id,
        p_owner_id: ownerId,
        p_idempotency_key: idempotencyKey,
        p_customer_name: order.customerInfo.name.trim(),
        p_customer_phone: order.customerInfo.phone.trim(),
        p_customer_address: order.customerInfo.address.trim(),
        p_total_amount: submitTotal,
        p_customer_governorate: order.customerInfo.governorate?.trim() || null,
        p_notes: order.customerInfo.notes?.trim() || null,
        p_items: orderItems,
        p_payment_method: paymentMethod,
        p_coupon_code: couponCode || null,
        p_store_slug: storeSlug?.trim().toLowerCase() || null,
      });

      if (!error && data?.success) {
        const orderId = data.order_id as string;
        const wasIdempotent = data.idempotent === true;

        if (wasIdempotent) {
          logger.info('order.create.idempotent', { orderId, ownerId, attempt });
          metrics.increment('checkout.submit.idempotent');
        }

        if (marketingAttribution && storeSlug?.trim() && !wasIdempotent) {
          await (supabase as any).rpc('attach_order_marketing_attribution', {
            p_order_id: orderId,
            p_store_slug: storeSlug.trim().toLowerCase(),
            p_attribution: marketingAttribution,
          });
        }

        if (storeSlug?.trim() && !wasIdempotent) {
          void (supabase as any).functions
            .invoke('meta-conversions', {
              body: {
                store_slug: storeSlug.trim().toLowerCase(),
                order_id: orderId,
                value: Number(data.total_amount ?? order.total),
                currency: 'IQD',
                content_ids: order.items.map((item) => item.product.id),
                customer_phone: order.customerInfo.phone || null,
                event_source_url: typeof window !== 'undefined' ? window.location.href : null,
              },
            })
            .catch((err: unknown) => {
              logger.warn('meta-conversions.invoke.failed', {
                orderId,
                message: err instanceof Error ? err.message : String(err),
              });
            });
        }

        logger.info('order.create.success', { orderId, ownerId, attempt, wasIdempotent });
        recordHealthEvent('order', true);
        if (!wasIdempotent) {
          flushOrderCache(ownerId);
          void invalidateStorefrontScope(ownerId, 'full', { bumpVersion: true });
        }
        return {
          ...order,
          id: orderId,
          total: Number(data.total_amount ?? order.total),
          wasIdempotent,
        };
      }

      if (error) {
        lastError = mapOrderRpcFailure({ error: error.message });
        logger.warn('order.create.rpc_transport_error', {
          ownerId,
          attempt,
          error: error.message,
        });

        if (attempt < maxAttempts && isRetryableOrderError(lastError)) {
          await sleep(400 * attempt);
          continue;
        }

        const recovered = await tryRecoverCheckoutOrder(ownerId, storeSlug);
        if (recovered) {
          logger.info('order.create.recovered_after_transport_error', {
            orderId: recovered.orderId,
            ownerId,
            attempt,
          });
          metrics.increment('checkout.submit.recovered');
          return buildRecoveredOrderResult(order, recovered);
        }

        throw new Error(lastError);
      }

      if (
        data?.error === 'total_amount_mismatch' &&
        data?.expected_total != null &&
        attempt < maxAttempts
      ) {
        submitTotal = Number(data.expected_total);
        logger.warn('order.create.total_mismatch_retry', {
          ownerId,
          attempt,
          expectedTotal: submitTotal,
          receivedTotal: order.total,
        });
        await sleep(200);
        continue;
      }

      lastError = mapOrderRpcFailure(data ?? { error: error?.message });
      logger.warn('order.create.retry', {
        ownerId,
        attempt,
        error: lastError,
        rpcError: data?.error,
        productName: data?.product_name,
        expectedTotal: data?.expected_total,
        receivedTotal: order.total,
      });

      if (attempt < maxAttempts && isRetryableOrderError(lastError)) {
        await sleep(400 * attempt);
        continue;
      }

      recordHealthEvent('order', false, { message: lastError });
      throw new Error(lastError);
    }

    const recovered = await tryRecoverCheckoutOrder(ownerId, storeSlug);
    if (recovered) {
      logger.info('order.create.recovered_after_retries', {
        orderId: recovered.orderId,
        ownerId,
      });
      metrics.increment('checkout.submit.recovered');
      return buildRecoveredOrderResult(order, recovered);
    }

    recordHealthEvent('order', false, { message: lastError });
    throw new Error(lastError);
  }, { ownerId, paymentMethod, itemCount: order.items.length });

  inflightOrders.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inflightOrders.delete(inflightKey);
  }
};
