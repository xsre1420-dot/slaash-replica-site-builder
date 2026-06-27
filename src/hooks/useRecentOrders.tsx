import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';
import { fetchRecentOrders } from '@/services/orderService';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import { cache, CacheKeys } from '@/lib/cache';
import { DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';
import { serializeOrderFilters } from '@/utils/orderQueryBuilder';
import type { OrdersPageResult } from '@/services/orderService';

const readCachedRecent = (ownerId: string | undefined, limit: number): Order[] => {
  if (!ownerId) return [];
  const recent = cache.get<Order[]>(CacheKeys.ordersRecent(ownerId));
  if (recent?.length) return recent.slice(0, limit);

  const filterKey = serializeOrderFilters(DEFAULT_ORDER_FILTERS);
  const page0 = cache.get<OrdersPageResult>(CacheKeys.ordersFiltered(ownerId, filterKey, 0));
  if (page0?.orders?.length) return page0.orders.slice(0, limit);

  return [];
};

export const useRecentOrders = (limit = 5) => {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const [orders, setOrders] = useState<Order[]>(() => readCachedRecent(user?.id, limit));
  const [loading, setLoading] = useState(() => readCachedRecent(user?.id, limit).length === 0);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchRecentOrders(user.id, limit);
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit]);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    const cached = readCachedRecent(user.id, limit);
    if (cached.length > 0) {
      setOrders(cached);
      setLoading(false);
      return;
    }
    void reload();
  }, [isReady, hydrationVersion, reload, user?.id, limit]);

  const refetch = useCallback(() => {
    if (user?.id) cache.del(CacheKeys.ordersRecent(user.id));
    void reload();
  }, [reload, user?.id]);

  return { orders, loading, refetch };
};
