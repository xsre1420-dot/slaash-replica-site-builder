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
  filterOrdersList,
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
  const [tabCounts, setTabCounts] = useState<WorkflowTabCounts>(EMPTY_TAB_COUNTS);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const lastVisibilityRefetchRef = useRef(0);

  const filterKey = useMemo(() => serializeOrderFilters(listFilters), [listFilters]);

  const serverFilters = useMemo(
    (): OrderListFilters => ({ ...listFilters, workflowTab: 'all' }),
    [
      listFilters.search,
      listFilters.orderStatus,
      listFilters.paymentStatus,
      listFilters.deliveryStatus,
      listFilters.datePreset,
      listFilters.minValue,
      listFilters.maxValue,
    ]
  );

  const serverFilterKey = useMemo(
    () => serializeOrderFilters(serverFilters),
    [serverFilters]
  );

  const visibleOrders = useMemo(
    () => filterOrdersList(orders, listFilters),
    [orders, listFilters]
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

  const loadAllOrders = useCallback(async () => {
    const ownerId = user?.id;
    if (!ownerId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const allOrders: Order[] = [];
      let cursor: string | null = null;
      let pageNum = 0;

      while (true) {
        const dedupKey = `fetch-orders-${ownerId}-${serverFilterKey}-${pageNum}-${cursor ?? 'start'}`;
        const result = await dedup(dedupKey, () =>
          fetchOrdersFiltered(ownerId, serverFilters, pageNum, ORDERS_PER_PAGE, cursor)
        );

        allOrders.push(...result.orders);

        if (!result.nextCursor || result.orders.length === 0) break;

        cursor = result.nextCursor;
        pageNum += 1;
      }

      setOrders(allOrders);
      allOrders.forEach((o) => knownOrderIdsRef.current.add(o.id));
    } catch (err) {
      console.error('[useOrders] load failed:', err);
      toast.error('تعذر تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [user?.id, serverFilterKey, serverFilters]);

  useEffect(() => {
    if (!isReady) return;
    void loadTabCounts();
  }, [isReady, hydrationVersion, loadTabCounts]);

  useEffect(() => {
    if (!isReady) return;
    void loadAllOrders();
  }, [isReady, hydrationVersion, loadAllOrders]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !user?.id) return;
      const now = Date.now();
      if (now - lastVisibilityRefetchRef.current < VISIBILITY_REFETCH_MS) return;
      lastVisibilityRefetchRef.current = now;
      flushOrderListCache(user.id);
      void loadAllOrders();
      void loadTabCounts();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadAllOrders, loadTabCounts, user?.id]);

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
    void loadAllOrders();
    void loadTabCounts();
  }, [loadAllOrders, loadTabCounts, user?.id]);

  const isNewOrder = useCallback((orderId: string) => {
    return !knownOrderIdsRef.current.has(orderId);
  }, []);

  const markOrderKnown = useCallback((orderId: string) => {
    knownOrderIdsRef.current.add(orderId);
  }, []);

  return useMemo(
    () => ({
      orders: visibleOrders,
      updateOrderStatus: updateOrderStatusLocal,
      loading,
      total: visibleOrders.length,
      tabCounts,
      refetch,
      isNewOrder,
      markOrderKnown,
    }),
    [visibleOrders, updateOrderStatusLocal, loading, tabCounts, refetch, isNewOrder, markOrderKnown]
  );
};

export type { WorkflowTabCounts, OrderWorkflowTab };
