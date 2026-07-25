import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Order } from '@/types';
import { dedup, flushOrderCache, flushOrderListCache, cache, CacheKeys } from '@/lib/cache';
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
} from '@/services/orderService';
import {
  DEFAULT_ORDER_FILTERS,
  OrderListFilters,
  OrderWorkflowTab,
} from '@/utils/orderWorkflowUtils';
import { serializeOrderFilters } from '@/utils/orderQueryBuilder';
import { markLocalOrderMutation } from '@/lib/localMutationGuard';

const EMPTY_TAB_COUNTS: WorkflowTabCounts = {
  new: 0,
  completed: 0,
  cancelled: 0,
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

  useEffect(() => {
    setPage(0);
  }, [filterKey]);

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

  const loadOrdersPage = useCallback(
    async (pageNum: number) => {
      const ownerId = user?.id;
      if (!ownerId) {
        setOrders([]);
        setTotal(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const dedupKey = `fetch-orders-${ownerId}-${filterKey}-${pageNum}`;
        const result = await dedup(dedupKey, () =>
          fetchOrdersFiltered(ownerId, listFilters, pageNum, ORDERS_PER_PAGE)
        );

        setOrders(result.orders);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        result.orders.forEach((o) => knownOrderIdsRef.current.add(o.id));
      } catch (err) {
        console.error('[useOrders] load failed:', err);
        toast.error('تعذر تحميل الطلبات');
      } finally {
        setLoading(false);
      }
    },
    [user?.id, filterKey, listFilters]
  );

  useEffect(() => {
    if (!isReady) return;
    void loadTabCounts();
  }, [isReady, hydrationVersion, loadTabCounts]);

  useEffect(() => {
    if (!isReady) return;
    void loadOrdersPage(page);
  }, [isReady, hydrationVersion, page, loadOrdersPage]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !user?.id) return;
      const now = Date.now();
      if (now - lastVisibilityRefetchRef.current < VISIBILITY_REFETCH_MS) return;
      lastVisibilityRefetchRef.current = now;
      flushOrderListCache(user.id);
      void loadOrdersPage(page);
      void loadTabCounts();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadOrdersPage, loadTabCounts, page, user?.id]);

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
      setOrders((prev) => {
        const current = prev.find((o) => o.id === orderId);
        if (!current) return prev;

        const updated: Order = {
          ...current,
          status: newStatus,
          ...(newStatus === 'completed' ? { deliveryStatus: 'delivered' } : {}),
        };

        return prev.map((o) => (o.id === orderId ? updated : o));
      });
      flushOrderCache(ownerId);
      void loadTabCounts();
      return true;
    }

    toast.error(mapOrderError(result.error || 'فشل التحديث'));
    return false;
  };

  const refetch = useCallback(() => {
    if (user?.id) flushOrderCache(user.id);
    void loadOrdersPage(page);
    void loadTabCounts();
  }, [loadOrdersPage, loadTabCounts, page, user?.id]);

  const goToPage = useCallback((nextPage: number) => {
    setPage(Math.max(0, nextPage));
  }, []);

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
      goToPage,
      total,
      totalPages,
      pageSize: ORDERS_PER_PAGE,
      tabCounts,
      refetch,
      isNewOrder,
      markOrderKnown,
    }),
    [
      orders,
      updateOrderStatusLocal,
      loading,
      page,
      goToPage,
      total,
      totalPages,
      tabCounts,
      refetch,
      isNewOrder,
      markOrderKnown,
    ]
  );
};

export type { WorkflowTabCounts, OrderWorkflowTab };
