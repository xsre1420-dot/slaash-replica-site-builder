import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Order } from "@/types";
import { fetchOrderById } from "@/services/orderService";

export { mapDbOrder } from "@/mappers/orderMapper";

export const useOrderData = (orderId: string | undefined) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setOrder(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const result = await fetchOrderById(orderId, user.id);
      setOrder(result);
      setLoading(false);
    };

    load();
  }, [orderId, user?.id]);

  return { order, loading };
};
