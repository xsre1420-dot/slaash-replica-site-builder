
import { supabase } from '@/integrations/supabase/client';
import { DatabaseData } from '@/types/statistics';
import { cache, CacheKeys, CacheTTL, dedup } from '@/lib/cache';

const withTimeout = <T>(promise: Promise<T>, ms = 12000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms)),
  ]);
};

const ORDER_LIST_COLUMNS = 'id,status,total_amount,created_at,customer_name,customer_phone,payment_method';
const ORDERS_STATS_CAP = 5000;

export interface StatisticsDateBounds {
  start: Date;
  end: Date;
  days: number;
  previousStart: Date;
}

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
    if (error) {
      console.warn('[statistics] get_store_statistics unavailable, using client fallback:', error.message);
      return undefined;
    }
    return (data as Record<string, unknown>) ?? undefined;
  } catch (err) {
    console.warn('[statistics] get_store_statistics RPC failed:', err);
    return undefined;
  }
};

const fetchProductCount = async (ownerId: string): Promise<number> => {
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

export const fetchStatisticsData = async (
  dateRange: string,
  customStart?: string,
  customEnd?: string
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

  const cached = cache.get<DatabaseData>(cacheKey);
  if (cached) return cached;

  return dedup(cacheKey, async () => {
    const fetchFrom = bounds.previousStart.toISOString();
    const fetchTo = bounds.end.toISOString();
    const periodStart = bounds.start.toISOString();
    const periodEnd = bounds.end.toISOString();
    const previousEnd = new Date(bounds.start.getTime() - 1);
    previousEnd.setHours(23, 59, 59, 999);

    try {
      const [ordersRes, kpis, previousKpis, visitsRes, productCount] = await withTimeout(
        Promise.all([
          supabase
            .from('orders')
            .select(ORDER_LIST_COLUMNS)
            .eq('owner_id', ownerId)
            .gte('created_at', fetchFrom)
            .lte('created_at', fetchTo)
            .order('created_at', { ascending: false })
            .limit(ORDERS_STATS_CAP),
          fetchStoreStatisticsRpc(ownerId, periodStart, periodEnd),
          fetchStoreStatisticsRpc(ownerId, bounds.previousStart.toISOString(), previousEnd.toISOString()),
          supabase
            .from('store_visits')
            .select('id, created_at, visitor_ip')
            .eq('owner_id', ownerId)
            .gte('created_at', fetchFrom)
            .lte('created_at', fetchTo)
            .limit(ORDERS_STATS_CAP),
          fetchProductCount(ownerId),
        ])
      );

      let orders: DatabaseData['orders'] = [];
      if (ordersRes.error) {
        console.warn('[statistics] orders fetch failed:', ordersRes.error.message);
      } else {
        orders = ordersRes.data || [];
      }

      let visits: DatabaseData['visits'] = [];
      if (visitsRes.error) {
        console.warn('[statistics] store_visits fetch failed:', visitsRes.error.message);
      } else {
        visits = visitsRes.data || [];
      }

      const orderIds = orders.map((o: { id: string }) => o.id);

      let orderItems: DatabaseData['orderItems'] = [];
      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, product_id, product_name, quantity, subtotal, created_at')
          .eq('owner_id', ownerId)
          .in('order_id', orderIds);

        if (itemsError) {
          console.warn('[statistics] order_items fetch failed:', itemsError.message);
        } else {
          orderItems = itemsData || [];
        }
      }

      const truncated =
        orders.length >= ORDERS_STATS_CAP || visits.length >= ORDERS_STATS_CAP;

      const result: DatabaseData = {
        orders,
        orderItems,
        customers: [],
        products: productCount > 0 ? Array(productCount).fill(null) : [],
        visits,
        kpis,
        previousKpis,
        truncated,
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
        dateBounds: bounds,
      };
    }
  });
};
