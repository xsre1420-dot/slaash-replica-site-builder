
import { supabase } from "@/integrations/supabase/client";
import { DatabaseData } from "@/types/statistics";
import { cache, CacheKeys, CacheTTL, dedup } from "@/lib/cache";

const withTimeout = <T>(promise: Promise<T>, ms = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms))
  ]);
};

export const fetchStatisticsData = async (dateRange: string): Promise<DatabaseData> => {
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = user?.id;
  const cacheKey = CacheKeys.statistics(ownerId || 'anon', dateRange);

  if (!ownerId) {
    return { orders: [], orderItems: [], customers: [], products: [], visits: [] };
  }

  const cached = cache.get<DatabaseData>(cacheKey);
  if (cached) return cached;

  return dedup(cacheKey, async () => {
    const days = parseInt(dateRange) || 7;
    const extendedDays = days * 2;
    const extendedStart = new Date(Date.now() - extendedDays * 86400000);
    const dateFilter = extendedStart.toISOString();

    const [ordersRes, productsRes] = await withTimeout(
      Promise.all([
        supabase.from('orders')
          .select('id,status,total_amount,created_at,customer_name,customer_phone')
          .eq('owner_id', ownerId)
          .gte('created_at', dateFilter),
        supabase.from('products')
          .select('id,name,price,stock_quantity')
          .eq('owner_id', ownerId),
      ]),
      12000
    );

    if (ordersRes.error || productsRes.error) {
      console.error('Statistics fetch failed:', ordersRes.error || productsRes.error);
      throw ordersRes.error || productsRes.error;
    }

    const result: DatabaseData = {
      orders: ordersRes.data || [],
      orderItems: [],
      customers: [],
      products: productsRes.data || [],
      visits: [],
    };

    cache.set(cacheKey, result, CacheTTL.SHORT, CacheTTL.STALE);
    return result;
  });
};
