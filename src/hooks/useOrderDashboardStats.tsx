import { useState, useEffect, useCallback } from 'react';
import { fetchOrderStatsSummary, type OrderDashboardStats } from '@/services/orderService';
import { useAuth } from '@/context/AuthContext';

const EMPTY_STATS: OrderDashboardStats = {
  total: 0,
  newOrders: 0,
  pendingFulfillment: 0,
  delivered: 0,
  revenue: 0,
};

export const useOrderDashboardStats = (refreshKey = 0) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<OrderDashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const summary = await fetchOrderStatsSummary(user.id);
      setStats(summary);
    } catch (err) {
      console.error('[orders] stats summary failed:', err);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return { stats, statsLoading: loading, reloadStats: reload };
};
