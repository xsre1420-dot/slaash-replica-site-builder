import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Order } from '@/types';
import { dedup, flushOrderCache, cache, CacheKeys } from '@/lib/cache';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import { mapOrderError } from '@/utils/orderErrors';
import { canTransitionOrderStatus } from '@/utils/orderStatusUtils';
import {
  fetchOrdersFiltered,
  fetchWorkflowTabCounts,
  updateOrderStatus,
  ORDERS_PER_PAGE,
  type WorkflowTabCounts,
  type OrdersPageResult,
} from '@/services/orderService';
import {
  DEFAULT_ORDER_FILTERS,
  OrderListFilters,
  OrderWorkflowTab,
} from '@/utils/orderWorkflowUtils';
import { serializeOrderFilters } from '@/utils/orderQueryBuilder';
import { markLocalOrderMutation } from '@/lib/localMutationGuard';

const EMPTY_TAB_COUNTS: WorkflowTabCounts = {
  all: 0,
  new: 0,
  processing: 0,
  paid: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
  refunded: 0,
};

const VISIBILITY_REFETCH_MS = 60_000;

export const useOrders = (listFilters: OrderListFilters = DEFAULT_ORDER_FILTERS) => {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tabCounts, setTabCounts] = useState<WorkflowTabCounts>(EMPTY_TAB_COUNTS);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const lastVisibilityRefetchRef = useRef(0);

  const filterKey = useMemo(() => serializeOrderFilters(listFilters), [listFilters]);

  const applyOrdersPage = useCallback((result: OrdersPageResult, pageNum: number) => {
    setOrders(result.orders);
    setTotal(result.total);
    setTotalPages(result.totalPages);
    setPage(pageNum);
    result.orders.forEach((o) => knownOrderIdsRef.current.add(o.id));
  }, []);

  const readCachedPage = useCallback(
    (ownerId: string, pageNum: number): OrdersPageResult | null =>
      cache.get<OrdersPageResult>(CacheKeys.ordersFiltered(ownerId, filterKey, pageNum)),
    [filterKey]
  );

  const loadTabCounts = useCallback(async () => {
    const ownerId = user?.id;
    if (!ownerId) {
      setTabCounts(EMPTY_TAB_COUNTS);
      return;
    }

    try {
      const counts = await dedup(`fetch-wc-${ownerId}-${filterKey}`, () =>
        fetchWorkflowTabCounts(ownerId, listFilters)
      );
      setTabCounts(counts);
    } catch (err) {
      console.error('[useOrders] tab counts failed:', err);
    }
  }, [user?.id, filterKey, listFilters]);

  const loadPage = useCallback(
    async (pageNum: number) => {
      const ownerId = user?.id;
      if (!ownerId) {
        setOrders([]);
        setTotal(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      const warmed = readCachedPage(ownerId, pageNum);
      if (warmed) {
        applyOrdersPage(warmed, pageNum);
        setLoading(false);
        return;
      }

      setLoading(true);
      const dedupKey = `fetch-orders-${ownerId}-${filterKey}-${pageNum}`;

      try {
        const result = await dedup(dedupKey, () =>
          fetchOrdersFiltered(ownerId, listFilters, pageNum, ORDERS_PER_PAGE)
        );

        applyOrdersPage(result, pageNum);
      } catch (err) {
        console.error('[useOrders] load failed:', err);
        toast.error('تعذر تحميل الطلبات');
      } finally {
        setLoading(false);
      }
    },
    [user?.id, filterKey, listFilters, readCachedPage, applyOrdersPage]
  );

  useEffect(() => {
    if (!isReady) return;
    void loadTabCounts();
  }, [isReady, hydrationVersion, loadTabCounts]);

  useEffect(() => {
    if (!isReady) return;
    setPage(0);
    void loadPage(0);
  }, [isReady, hydrationVersion, loadPage]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !user?.id) return;
      const now = Date.now();
      if (now - lastVisibilityRefetchRef.current < VISIBILITY_REFETCH_MS) return;
      lastVisibilityRefetchRef.current = now;
      flushOrderCache(user.id);
      void loadPage(page);
      void loadTabCounts();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadPage, loadTabCounts, page, user?.id]);

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, totalPages - 1));
      if (clamped !== page && !loading) void loadPage(clamped);
    },
    [page, totalPages, loading, loadPage]
  );

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
      markLocalOrderMutation(orderId);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: newStatus,
                ...(newStatus === 'completed' ? { deliveryStatus: 'delivered' } : {}),
              }
            : o
        )
      );
      flushOrderCache(ownerId);
      void loadTabCounts();
      return true;
    }

    toast.error(mapOrderError(result.error || 'فشل التحديث'));
    return false;
  };

  const refetch = useCallback(() => {
    if (user?.id) flushOrderCache(user.id);
    void loadPage(page);
    void loadTabCounts();
  }, [loadPage, loadTabCounts, page, user?.id]);

  const isNewOrder = useCallback((orderId: string) => {
    return !knownOrderIdsRef.current.has(orderId);
  }, []);

  const markOrderKnown = useCallback((orderId: string) => {
    knownOrderIdsRef.current.add(orderId);
  }, []);

  return useMemo(
    () => ({
      orders,
      updateOrderStatus: updateOrderStatusLocal,
      loading,
      page,
      total,
      totalPages,
      tabCounts,
      goToPage,
      refetch,
      isNewOrder,
      markOrderKnown,
      /** @deprecated use goToPage */
      hasMore: page < totalPages - 1,
      /** @deprecated use goToPage */
      loadMore: () => goToPage(page + 1),
    }),
    [
      orders,
      updateOrderStatusLocal,
      loading,
      page,
      total,
      totalPages,
      tabCounts,
      goToPage,
      refetch,
      isNewOrder,
      markOrderKnown,
    ]
  );
};

export type { WorkflowTabCounts, OrderWorkflowTab };
