import { useState, useEffect, useCallback } from "react";
import { Order } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapDbOrder } from "@/hooks/useOrderData";
import { format } from "date-fns";

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map(mapDbOrder);
      setOrders(mapped);
      setFilteredOrders(mapped);
    } else {
      console.error('Error fetching orders:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    let filtered = [...orders];

    if (searchQuery) {
      filtered = filtered.filter(
        (order) =>
          order.customerInfo.name.includes(searchQuery) ||
          order.customerInfo.phone.includes(searchQuery) ||
          order.id.includes(searchQuery)
      );
    }

    if (dateFilter) {
      const filterDate = format(dateFilter, "yyyy-MM-dd");
      filtered = filtered.filter((order) =>
        order.date.startsWith(filterDate)
      );
    }

    setFilteredOrders(filtered);
  }, [searchQuery, dateFilter, orders]);

  const archiveOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' as const } : o));
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: "pending" | "completed" | "cancelled") => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    }
  };

  const clearDateFilter = () => setDateFilter(undefined);

  return {
    orders,
    filteredOrders,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    archiveOrder,
    updateOrderStatus,
    clearDateFilter,
    loading,
    refetch: fetchOrders,
  };
};
