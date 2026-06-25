import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types';
import { fetchRecentOrders } from '@/services/orderService';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import { cache, CacheKeys } from '@/lib/cache';

export const useRecentOrders = (limit = 5) => {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!isReady) return;
    void reload();
  }, [isReady, hydrationVersion, reload]);

  const refetch = useCallback(() => {
    if (user?.id) cache.del(CacheKeys.ordersRecent(user.id));
    void reload();
  }, [reload, user?.id]);

  return { orders, loading, refetch };
};
