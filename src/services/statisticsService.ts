
import { supabase } from '@/integrations/supabase/client';
import { DatabaseData } from '@/types/statistics';
import { cache, CacheKeys, CacheTTL, clearInflight, dedup } from '@/lib/cache';

const withTimeout = <T>(promise: Promise<T>, ms = 12000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms)),
  ]);
};

/** Order columns needed for chart, payment mix, peak hours, and client KPI fallback. */
const CHART_ORDER_COLUMNS =
  'id,status,total_amount,created_at,customer_name,customer_phone,payment_method,payment_status';

/** When RPC supplies KPIs, only load current-period rows for charts/breakdowns. */
const CHART_ORDERS_CAP = 5000;
const VISITS_CAP = 5000;
/** Full client-side fallback when RPC is unavailable. */
const FALLBACK_ORDERS_CAP = 5000;
const FALLBACK_VISITS_CAP = 5000;

export interface StatisticsDateBounds {
  start: Date;
  end: Date;
  days: number;
  previousStart: Date;
}

export const hasUsableStatisticsKpis = (kpis?: Record<string, unknown>): boolean =>
  kpis != null &&
  typeof kpis === 'object' &&
  (kpis.order_count != null || kpis.completed_order_count != null || kpis.visit_count != null);

export const hasTopSellingProductsKpi = (kpis?: Record<string, unknown>): boolean =>
  Array.isArray(kpis?.top_selling_products) && (kpis.top_selling_products as unknown[]).length > 0;

const fetchStatisticsPageBundleRpc = async (
  ownerId: string,
  periodStart: string,
  periodEnd: string,
  previousStart: string,
  previousEnd: string
): Promise<{ current?: Record<string, unknown>; previous?: Record<string, unknown> } | undefined> => {
  try {
    const { data, error } = await (supabase as any).rpc('get_statistics_page_bundle', {
      p_owner_id: ownerId,
      p_current_start: periodStart,
      p_current_end: periodEnd,
      p_previous_start: previousStart,
      p_previous_end: previousEnd,
    });
    if (!error && data && typeof data === 'object') {
      const payload = data as Record<string, unknown>;
      return {
        current: (payload.current as Record<string, unknown>) ?? undefined,
        previous: (payload.previous as Record<string, unknown>) ?? undefined,
      };
    }
    if (error) {
      console.warn('[statistics] get_statistics_page_bundle unavailable, using single-period RPC:', error.message);
    }
    return undefined;
  } catch (err) {
    console.warn('[statistics] get_statistics_page_bundle RPC failed:', err);
    return undefined;
  }
};

export const getStatisticsDateBounds = (
  dateRange: string,
  customStart?: string,
  customEnd?: string
): StatisticsDateBounds => {
  if (dateRange === 'custom' && customStart && customEnd) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const previousStart = new Date(start.getTime() - days * 86400000);
    previousStart.setHours(0, 0, 0, 0);
    return { start, end, days, previousStart };
  }

  const days = parseInt(dateRange, 10) || 7;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end.getTime() - days * 86400000);
  start.setHours(0, 0, 0, 0);
  const previousStart = new Date(start.getTime() - days * 86400000);
  previousStart.setHours(0, 0, 0, 0);
  return { start, end, days, previousStart };
};

const fetchStoreStatisticsRpc = async (
  ownerId: string,
  periodStart: string,
  periodEnd: string
): Promise<Record<string, unknown> | undefined> => {
  try {
    const { data, error } = await (supabase as any).rpc('get_store_statistics', {
      p_owner_id: ownerId,
      p_start: periodStart,
      p_end: periodEnd,
    });
    if (!error && data) {
      return data as Record<string, unknown>;
    }

    if (error) {
      console.warn('[statistics] get_store_statistics unavailable, using client fallback:', error.message);
    }
    return undefined;
  } catch (err) {
    console.warn('[statistics] get_store_statistics RPC failed:', err);
    return undefined;
  }
};

const fetchProductCount = async (
  ownerId: string,
  kpis?: Record<string, unknown>
): Promise<number> => {
  const fromKpi = kpis?.product_count;
  if (fromKpi != null && fromKpi !== '') {
    const n = Number(fromKpi);
    if (Number.isFinite(n)) return n;
  }

  const activeRes = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .is('archived_at', null);

  if (!activeRes.error && activeRes.count != null) {
    return activeRes.count;
  }

  const allRes = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);

  if (allRes.error) {
    console.warn('[statistics] products count failed:', allRes.error.message);
    return 0;
  }

  return allRes.count ?? 0;
};

const fetchOrdersForStatistics = async (
  ownerId: string,
  fromIso: string,
  toIso: string,
  cap: number
): Promise<{ orders: DatabaseData['orders']; error?: string }> => {
  const { data, error } = await supabase
    .from('orders')
    .select(CHART_ORDER_COLUMNS)
    .eq('owner_id', ownerId)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(cap);

  if (error) {
    return { orders: [], error: error.message };
  }

  return { orders: data || [] };
};

const fetchVisitsForStatistics = async (
  ownerId: string,
  fromIso: string,
  toIso: string,
  cap: number
): Promise<{ visits: DatabaseData['visits']; error?: string }> => {
  const { data, error } = await supabase
    .from('store_visits')
    .select('id, created_at, visitor_ip')
    .eq('owner_id', ownerId)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .limit(cap);

  if (error) {
    return { visits: [], error: error.message };
  }

  return { visits: data || [] };
};

const fetchOrderItemsForStatistics = async (
  ownerId: string,
  fromIso: string,
  toIso: string
): Promise<DatabaseData['orderItems']> => {
  try {
    const { data, error } = await (supabase as any).rpc('get_order_items_for_statistics', {
      p_owner_id: ownerId,
      p_start: fromIso,
      p_end: toIso,
      p_limit: 5000,
    });

    if (!error && Array.isArray(data)) {
      return data as DatabaseData['orderItems'];
    }
    if (!error && data && typeof data === 'object') {
      return (data as DatabaseData['orderItems']) ?? [];
    }
  } catch {
    /* RPC optional until migration applied */
  }

  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, product_id, product_name, quantity, subtotal, created_at')
    .eq('owner_id', ownerId)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .limit(5000);

  if (error) {
    console.warn('[statistics] order_items fetch failed:', error.message);
    return [];
  }

  return data || [];
};

/** Match get_store_statistics customer semantics when RPC KPIs are missing. */
const fetchCustomerMetricsForStatistics = async (
  ownerId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ new_customers: number; returning_customers: number }> => {
  const [newResult, returningResult] = await Promise.all([
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .gte('first_order_date', periodStart)
      .lte('first_order_date', periodEnd),
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .lt('first_order_date', periodStart)
      .gte('last_order_date', periodStart)
      .lte('last_order_date', periodEnd),
  ]);

  if (newResult.error && returningResult.error) {
    return { new_customers: 0, returning_customers: 0 };
  }

  return {
    new_customers: newResult.count ?? 0,
    returning_customers: returningResult.count ?? 0,
  };
};

export const fetchStatisticsData = async (
  dateRange: string,
  customStart?: string,
  customEnd?: string,
  options?: { skipCache?: boolean }
): Promise<DatabaseData> => {
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = user?.id;
  const bounds = getStatisticsDateBounds(dateRange, customStart, customEnd);
  const cacheKey = CacheKeys.statistics(
    ownerId || 'anon',
    dateRange === 'custom' ? `${customStart}_${customEnd}` : dateRange
  );

  if (!ownerId) {
    return { orders: [], orderItems: [], customers: [], products: [], visits: [], dateBounds: bounds };
  }

  if (options?.skipCache) {
    cache.del(cacheKey);
    clearInflight(cacheKey);
  }

  const cached = options?.skipCache ? null : cache.get<DatabaseData>(cacheKey);
  if (cached) return cached;

  return dedup(cacheKey, async () => {
    const periodStart = bounds.start.toISOString();
    const periodEnd = bounds.end.toISOString();
    const previousEnd = new Date(bounds.start.getTime() - 1);
    previousEnd.setHours(23, 59, 59, 999);
    const fallbackFrom = bounds.previousStart.toISOString();

    try {
      const previousStart = bounds.previousStart.toISOString();
      const bundle = await withTimeout(
        fetchStatisticsPageBundleRpc(ownerId, periodStart, periodEnd, previousStart, previousEnd.toISOString())
      );

      let kpis = bundle?.current;
      let previousKpis = bundle?.previous;

      if (!hasUsableStatisticsKpis(kpis)) {
        [kpis, previousKpis] = await withTimeout(
          Promise.all([
            fetchStoreStatisticsRpc(ownerId, periodStart, periodEnd),
            fetchStoreStatisticsRpc(ownerId, previousStart, previousEnd.toISOString()),
          ])
        );
      }

      const rpcReady = hasUsableStatisticsKpis(kpis);
      const ordersCap = rpcReady ? CHART_ORDERS_CAP : FALLBACK_ORDERS_CAP;
      const visitsCap = rpcReady ? VISITS_CAP : FALLBACK_VISITS_CAP;
      const ordersFrom = rpcReady ? periodStart : fallbackFrom;
      const visitsFrom = rpcReady ? periodStart : fallbackFrom;
      const skipVisits = rpcReady && hasUsableStatisticsKpis(previousKpis);
      const skipOrderItems = rpcReady && hasTopSellingProductsKpi(kpis);

      const [ordersResult, visitsResult, productCount, orderItems] = await withTimeout(
        Promise.all([
          fetchOrdersForStatistics(ownerId, ordersFrom, periodEnd, ordersCap),
          skipVisits
            ? Promise.resolve({ visits: [] as DatabaseData['visits'] })
            : fetchVisitsForStatistics(ownerId, visitsFrom, periodEnd, visitsCap),
          fetchProductCount(ownerId, kpis),
          skipOrderItems
            ? Promise.resolve([] as DatabaseData['orderItems'])
            : fetchOrderItemsForStatistics(ownerId, periodStart, periodEnd),
        ])
      );

      const fetchWarnings: string[] = [];

      if (ordersResult.error) {
        console.warn('[statistics] orders fetch failed:', ordersResult.error);
        fetchWarnings.push('تعذّر تحميل الطلبات — قد تظهر الأرقام ناقصة.');
      }

      if (visitsResult.error) {
        console.warn('[statistics] store_visits fetch failed:', visitsResult.error);
        fetchWarnings.push('تعذّر تحميل بيانات الزوار.');
      }

      const orders = ordersResult.orders;
      const visits = visitsResult.visits;

      let enrichedKpis = kpis;
      if (
        rpcReady &&
        kpis &&
        (kpis.new_customers == null || kpis.returning_customers == null)
      ) {
        const customerMetrics = await fetchCustomerMetricsForStatistics(
          ownerId,
          periodStart,
          periodEnd
        );
        enrichedKpis = { ...kpis, ...customerMetrics };
      }

      const truncated =
        orders.length >= ordersCap ||
        visits.length >= visitsCap ||
        (!rpcReady && orders.length >= FALLBACK_ORDERS_CAP);

      const result: DatabaseData = {
        orders,
        orderItems,
        customers: [],
        products: productCount > 0 ? Array(productCount).fill(null) : [],
        visits,
        kpis: enrichedKpis,
        previousKpis,
        truncated,
        fetchWarnings: fetchWarnings.length > 0 ? fetchWarnings : undefined,
        dateBounds: bounds,
      };

      cache.set(
        cacheKey,
        result,
        rpcReady ? CacheTTL.ANALYTICS : CacheTTL.SHORT,
        rpcReady ? CacheTTL.ANALYTICS_STALE : CacheTTL.STALE
      );
      return result;
    } catch (err) {
      console.error('[statistics] fetch failed, returning empty dataset:', err);
      return {
        orders: [],
        orderItems: [],
        customers: [],
        products: [],
        visits: [],
        fetchWarnings: ['تعذّر تحميل الإحصائيات. اضغط «تحديث» أو تحقق من اتصال قاعدة البيانات.'],
        dateBounds: bounds,
      };
    }
  });
};
