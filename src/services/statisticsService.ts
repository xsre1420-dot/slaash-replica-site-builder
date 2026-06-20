
import { supabase } from '@/integrations/supabase/client';
import { DatabaseData } from '@/types/statistics';
import { cache, CacheKeys, CacheTTL, clearInflight, dedup } from '@/lib/cache';

const withTimeout = <T>(promise: Promise<T>, ms = 12000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms)),
  ]);
};

/** Columns needed for chart, payment mix, peak hours, and client KPI fallback. */
const CHART_ORDER_COLUMNS =
  'id,status,total_amount,created_at,customer_name,customer_phone,payment_method';

/** When RPC supplies KPIs, only load current-period rows for charts/breakdowns. */
const CHART_ORDERS_CAP = 1000;
const VISITS_CAP = 1000;
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
  kpis != null && typeof kpis === 'object';

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

export const invalidateStatisticsCache = (
  ownerId: string,
  dateRange: string,
  customStart?: string,
  customEnd?: string
): void => {
  const rangeKey = dateRange === 'custom' ? `${customStart}_${customEnd}` : dateRange;
  const cacheKey = CacheKeys.statistics(ownerId, rangeKey);
  cache.del(cacheKey);
  clearInflight(cacheKey);
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
    .eq('is_active', true);

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
  orders: DatabaseData['orders']
): Promise<DatabaseData['orderItems']> => {
  const completedIds = orders
    .filter((o) => o.status === 'completed')
    .map((o) => o.id);

  if (completedIds.length === 0) return [];

  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, product_id, product_name, quantity, subtotal, created_at')
    .eq('owner_id', ownerId)
    .in('order_id', completedIds);

  if (error) {
    console.warn('[statistics] order_items fetch failed:', error.message);
    return [];
  }

  return data || [];
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
      const [kpis, previousKpis] = await withTimeout(
        Promise.all([
          fetchStoreStatisticsRpc(ownerId, periodStart, periodEnd),
          fetchStoreStatisticsRpc(
            ownerId,
            bounds.previousStart.toISOString(),
            previousEnd.toISOString()
          ),
        ])
      );

      const rpcReady = hasUsableStatisticsKpis(kpis);
      const ordersCap = rpcReady ? CHART_ORDERS_CAP : FALLBACK_ORDERS_CAP;
      const visitsCap = rpcReady ? VISITS_CAP : FALLBACK_VISITS_CAP;
      const ordersFrom = rpcReady ? periodStart : fallbackFrom;
      const visitsFrom = rpcReady ? periodStart : fallbackFrom;
      const skipVisits = rpcReady && hasUsableStatisticsKpis(previousKpis);

      const [ordersResult, visitsResult, productCount] = await withTimeout(
        Promise.all([
          fetchOrdersForStatistics(ownerId, ordersFrom, periodEnd, ordersCap),
          skipVisits
            ? Promise.resolve({ visits: [] as DatabaseData['visits'] })
            : fetchVisitsForStatistics(ownerId, visitsFrom, periodEnd, visitsCap),
          fetchProductCount(ownerId, kpis),
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
      const orderItems = await fetchOrderItemsForStatistics(ownerId, orders);

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
        kpis,
        previousKpis,
        truncated,
        fetchWarnings: fetchWarnings.length > 0 ? fetchWarnings : undefined,
        dateBounds: bounds,
      };

      cache.set(cacheKey, result, CacheTTL.SHORT, CacheTTL.STALE);
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
