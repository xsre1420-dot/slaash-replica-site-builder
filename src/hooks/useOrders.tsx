import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Order } from "@/types";
import { format } from "date-fns";
import { cache, CacheKeys, CacheTTL, dedup } from "@/lib/cache";
import { useAuth } from "@/context/AuthContext";
import { mapOrderError } from "@/utils/orderErrors";
import { canTransitionOrderStatus } from "@/utils/orderStatusUtils";
import { fetchOrdersPage, updateOrderStatus, ORDERS_PER_PAGE } from "@/services/orderService";
import { toast } from "sonner";

export const useOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const fetchOrders = useCallback(async (page = 0, append = false) => {
    const ownerId = user?.id;
    if (!ownerId) {
      setOrders([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (!append) setLoading(true);

    const cacheKey = CacheKeys.orders(ownerId, page);

    if (!append) {
      const cached = cache.get<Order[]>(cacheKey);
      if (cached) {
        setOrders(cached);
        setHasMore(cached.length === ORDERS_PER_PAGE);
        pageRef.current = page;
        setLoading(false);
        return;
      }
    }

    const mapped = await dedup(`fetch-orders-${ownerId}-${page}`, () =>
      fetchOrdersPage(ownerId, page, ORDERS_PER_PAGE)
    );

    cache.set(cacheKey, mapped, CacheTTL.SHORT, CacheTTL.STALE);

    if (append) {
      setOrders((prev) => [...prev, ...mapped]);
    } else {
      setOrders(mapped);
    }
    setHasMore(mapped.length === ORDERS_PER_PAGE);
    pageRef.current = page;
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchOrders(0);
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.customerInfo.name.toLowerCase().includes(q) ||
          order.customerInfo.phone.includes(q) ||
          order.id.includes(q)
      );
    }

    if (dateFilter) {
      const filterDate = format(dateFilter, "yyyy-MM-dd");
      filtered = filtered.filter((order) => order.date.startsWith(filterDate));
    }

    return filtered;
  }, [searchQuery, dateFilter, orders]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchOrders(pageRef.current + 1, true);
    }
  }, [hasMore, loading, fetchOrders]);

  const archiveOrder = async (orderId: string) => {
    const ownerId = user?.id;
    if (!ownerId) return;

    const order = orders.find((o) => o.id === orderId);
    if (order && !canTransitionOrderStatus(order.status, 'cancelled')) {
      toast.error('لا يمكن إلغاء هذا الطلب');
      return;
    }

    const result = await updateOrderStatus(orderId, ownerId, 'cancelled');

    if (result.success) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' as const } : o)));
      cache.flushByPrefix('orders:');
    } else {
      toast.error(mapOrderError(result.error || 'فشل التحديث'));
    }
  };

  const updateOrderStatusLocal = async (
    orderId: string,
    newStatus: "pending" | "completed" | "cancelled"
  ) => {
    const ownerId = user?.id;
    if (!ownerId) return;

    const order = orders.find((o) => o.id === orderId);
    if (order && !canTransitionOrderStatus(order.status, newStatus)) {
      toast.error('لا يمكن تغيير حالة الطلب بهذه الطريقة');
      return;
    }

    const result = await updateOrderStatus(orderId, ownerId, newStatus);

    if (result.success) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      cache.flushByPrefix('orders:');
      cache.flushByPrefix('stats:');
    } else {
      toast.error(mapOrderError(result.error || 'فشل التحديث'));
    }
  };

  const clearDateFilter = () => setDateFilter(undefined);

  const refetch = useCallback(() => {
    cache.flushByPrefix('orders:');
    fetchOrders(0);
  }, [fetchOrders]);

  return {
    orders,
    filteredOrders,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    archiveOrder,
    updateOrderStatus: updateOrderStatusLocal,
    clearDateFilter,
    loading,
    hasMore,
    loadMore,
    refetch,
  };
};
