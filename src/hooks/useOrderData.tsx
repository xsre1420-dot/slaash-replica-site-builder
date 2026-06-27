import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Order } from "@/types";
import { fetchOrderById } from "@/services/orderService";
import { flushOwnerCache } from "@/lib/cache";

export const useOrderData = (orderId: string | undefined) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orderId || !user?.id) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await fetchOrderById(orderId, user.id);
    setOrder(result);
    setLoading(false);
  }, [orderId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchOrderStatus = useCallback((status: Order['status']) => {
    setOrder((prev) => (prev ? { ...prev, status } : prev));
    if (user?.id) flushOwnerCache(user.id);
  }, [user?.id]);

  return { order, loading, refetch: load, patchOrderStatus };
};
