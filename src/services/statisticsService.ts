
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
  // Get current user for cache key
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = user?.id || 'anon';
  const cacheKey = CacheKeys.statistics(ownerId, dateRange);

  // Check cache first
  const cached = cache.get<DatabaseData>(cacheKey);
  if (cached) return cached;

  // Deduplicate concurrent requests for same range
  return dedup(cacheKey, async () => {
    const days = parseInt(dateRange) || 7;
    const extendedDays = days * 2;
    const extendedStart = new Date(Date.now() - extendedDays * 86400000);
    const dateFilter = extendedStart.toISOString();

    try {
      // Single parallel batch for all data
      const [ordersRes, productsRes] = await withTimeout(
        Promise.all([
          supabase.from('orders')
            .select('id,status,total,created_at,customer_name,customer_phone,delivery_fee')
            .gte('created_at', dateFilter),
          supabase.from('products')
            .select('id,name,price,stock_quantity'),
        ]),
        12000
      );

      const result: DatabaseData = {
        orders: ordersRes.data || [],
        orderItems: [],
        customers: [],
        products: productsRes.data || [],
        visits: [],
      };

      // Cache for 30s (volatile data)
      cache.set(cacheKey, result, CacheTTL.SHORT, CacheTTL.STALE);
      return result;
    } catch (error) {
      return { orders: [], orderItems: [], customers: [], products: [], visits: [] };
    }
  });
};
