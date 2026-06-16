import { useState, useEffect, useCallback, useRef } from "react";
import { Order } from "@/types";
import { cache, CacheKeys, CacheTTL, dedup, flushOwnerCache, clearInflight } from "@/lib/cache";
import { useAuth } from "@/context/AuthContext";
import { useStoreHydration } from "@/context/StoreBootstrapContext";
import { mapOrderError } from "@/utils/orderErrors";
import { canTransitionOrderStatus } from "@/utils/orderStatusUtils";
import { fetchOrdersPage, updateOrderStatus, ORDERS_PER_PAGE } from "@/services/orderService";
import { toast } from "sonner";

export const useOrders = () => {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  const fetchOrders = useCallback(async (page = 0, append = false) => {
    const ownerId = user?.id;
    if (!ownerId) {
      setOrders([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    const cacheKey = CacheKeys.orders(ownerId, page);
    const dedupKey = `fetch-orders-${ownerId}-${page}`;

    const loadPage = async () => {
      const fresh = await fetchOrdersPage(ownerId, page, ORDERS_PER_PAGE);
      cache.set(cacheKey, fresh, CacheTTL.SHORT, CacheTTL.STALE);
      return fresh;
    };

    if (!append) {
      const cached = cache.get<Order[]>(cacheKey, loadPage);
      if (cached) {
        setOrders(cached);
        cached.forEach((o) => knownOrderIdsRef.current.add(o.id));
        setHasMore(cached.length === ORDERS_PER_PAGE);
        pageRef.current = page;
        setLoading(false);
        return;
      }
      setLoading(true);
    } else {
      setLoading(true);
    }

    const mapped = await dedup(dedupKey, loadPage);

    if (append) {
      setOrders((prev) => [...prev, ...mapped]);
    } else {
      setOrders(mapped);
    }
    mapped.forEach((o) => knownOrderIdsRef.current.add(o.id));
    setHasMore(mapped.length === ORDERS_PER_PAGE);
    pageRef.current = page;
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!isReady) return;
    fetchOrders(0);
  }, [isReady, hydrationVersion, fetchOrders]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        clearInflight(`fetch-orders-${user.id}-0`);
        fetchOrders(0);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchOrders, user?.id]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchOrders(pageRef.current + 1, true);
    }
  }, [hasMore, loading, fetchOrders]);

  const updateOrderStatusLocal = async (
    orderId: string,
    newStatus: Order['status']
  ): Promise<boolean> => {
    const ownerId = user?.id;
    if (!ownerId) return false;

    const order = orders.find((o) => o.id === orderId);
    if (order && !canTransitionOrderStatus(order.status, newStatus)) {
      toast.error('لا يمكن تغيير حالة الطلب بهذه الطريقة');
      return false;
    }

    const result = await updateOrderStatus(orderId, ownerId, newStatus);

    if (result.success) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: newStatus,
                ...(newStatus === 'completed' ? { deliveryStatus: 'delivered' } : {}),
                ...(newStatus === 'cancelled' ? { deliveryStatus: o.deliveryStatus || 'pending' } : {}),
              }
            : o
        )
      );
      flushOwnerCache(ownerId);
      return true;
    }

    toast.error(mapOrderError(result.error || 'فشل التحديث'));
    return false;
  };

  const patchOrderInList = useCallback((orderId: string, patch: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o))
    );
  }, []);

  const refetch = useCallback(() => {
    if (user?.id) {
      flushOwnerCache(user.id);
      clearInflight(`fetch-orders-${user.id}-0`);
    }
    fetchOrders(0);
  }, [fetchOrders, user?.id]);

  const isNewOrder = useCallback((orderId: string) => {
    return !knownOrderIdsRef.current.has(orderId);
  }, []);

  const markOrderKnown = useCallback((orderId: string) => {
    knownOrderIdsRef.current.add(orderId);
  }, []);

  return {
    orders,
    updateOrderStatus: updateOrderStatusLocal,
    patchOrderInList,
    loading,
    hasMore,
    loadMore,
    refetch,
    isNewOrder,
    markOrderKnown,
  };
};
