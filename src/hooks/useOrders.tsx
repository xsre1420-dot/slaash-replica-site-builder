import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Order } from '@/types';
import { flushOrderCache, flushOrderListCache, cache, CacheKeys } from '@/lib/cache';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import { mapOrderError } from '@/utils/orderErrors';
import { canTransitionOrderStatus } from '@/utils/orderStatusUtils';
import {
  updateOrderStatus,
  ORDERS_PER_PAGE,
  type WorkflowTabCounts,
} from '@/services/orderService';
import type { OrderDashboardStats } from '@/types/orders';
import {
  DEFAULT_ORDER_FILTERS,
  OrderListFilters,
  OrderWorkflowTab,
} from '@/utils/orderWorkflowUtils';
import { markLocalOrderMutation } from '@/lib/localMutationGuard';
import {
  loadOrdersPageBundle,
  peekOrdersPageBundle,
  invalidateOrdersPageBundle,
} from '@/services/ordersPageService';
import { serializeOrderFilters } from '@/utils/orderQueryBuilder';

const EMPTY_TAB_COUNTS: WorkflowTabCounts = {
  new: 0,
  completed: 0,
  cancelled: 0,
};

const EMPTY_STATS: OrderDashboardStats = {
  total: 0,
  newOrders: 0,
  pendingFulfillment: 0,
  delivered: 0,
  revenue: 0,
  todayRevenue: 0,
  weekRevenue: 0,
  monthRevenue: 0,
  pendingRevenue: 0,
  avgOrderValue: 0,
  todayOrders: 0,
  weekOrders: 0,
  monthOrders: 0,
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
  const [stats, setStats] = useState<OrderDashboardStats>(EMPTY_STATS);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const lastVisibilityRefetchRef = useRef(0);

  const filterKey = useMemo(() => serializeOrderFilters(listFilters), [listFilters]);

  useEffect(() => {
    setPage(0);
  }, [filterKey]);

  const applyBundle = useCallback((bundle: NonNullable<ReturnType<typeof peekOrdersPageBundle>>) => {
    setOrders(bundle.orders);
    setTotal(bundle.total);
    setTotalPages(bundle.totalPages);
    setTabCounts(bundle.tabCounts);
    setStats(bundle.stats);
    bundle.orders.forEach((o) => knownOrderIdsRef.current.add(o.id));
  }, []);

  const loadBundle = useCallback(
    async (pageNum: number, options?: { force?: boolean }) => {
      const ownerId = user?.id;
      if (!ownerId) {
        setOrders([]);
        setTotal(0);
        setTotalPages(1);
        setTabCounts(EMPTY_TAB_COUNTS);
        setStats(EMPTY_STATS);
        setLoading(false);
        return;
      }

      if (!options?.force) {
        const cached = peekOrdersPageBundle(ownerId, listFilters, pageNum);
        if (cached) {
          applyBundle(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);

      try {
        const bundle = await loadOrdersPageBundle(ownerId, listFilters, pageNum, options);
        applyBundle(bundle);
      } catch (err) {
        console.error('[useOrders] load failed:', err);
        toast.error('تعذر تحميل الطلبات');
      } finally {
        setLoading(false);
      }
    },
    [user?.id, listFilters, applyBundle]
  );

  useEffect(() => {
    if (!isReady) return;
    void loadBundle(page);
  }, [isReady, hydrationVersion, page, loadBundle]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !user?.id) return;
      const now = Date.now();
      if (now - lastVisibilityRefetchRef.current < VISIBILITY_REFETCH_MS) return;
      lastVisibilityRefetchRef.current = now;
      flushOrderListCache(user.id);
      void loadBundle(page, { force: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadBundle, page, user?.id]);

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
      invalidateOrdersPageBundle(ownerId);
      void loadBundle(page, { force: true });
      return true;
    }

    toast.error(mapOrderError(result.error || 'فشل التحديث'));
    return false;
  };

  const refetch = useCallback(() => {
    if (user?.id) flushOrderCache(user.id);
    void loadBundle(page, { force: true });
  }, [loadBundle, page, user?.id]);

  const reloadStats = useCallback(() => {
    refetch();
  }, [refetch]);

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
      stats,
      refetch,
      reloadStats,
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
      stats,
      refetch,
      reloadStats,
      isNewOrder,
      markOrderKnown,
    ]
  );
};

export type { WorkflowTabCounts, OrderWorkflowTab };
