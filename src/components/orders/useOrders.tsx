import { useState, useEffect, useCallback, useRef } from "react";
import { Order } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapDbOrder } from "@/hooks/useOrderData";
import { format } from "date-fns";

const ORDERS_PER_PAGE = 50;

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const fetchOrders = useCallback(async (page = 0, append = false) => {
    if (!append) setLoading(true);
    
    const from = page * ORDERS_PER_PAGE;
    const to = from + ORDERS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total, delivery_fee, created_at, updated_at, customer_name, customer_phone, customer_address, customer_governorate, items, notes')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      const mapped = data.map(mapDbOrder);
      if (append) {
        setOrders(prev => [...prev, ...mapped]);
      } else {
        setOrders(mapped);
      }
      setHasMore(data.length === ORDERS_PER_PAGE);
      pageRef.current = page;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders(0);
  }, [fetchOrders]);

  // Client-side filtering
  useEffect(() => {
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

    setFilteredOrders(filtered);
  }, [searchQuery, dateFilter, orders]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchOrders(pageRef.current + 1, true);
    }
  }, [hasMore, loading, fetchOrders]);

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
    hasMore,
    loadMore,
    refetch: () => fetchOrders(0),
  };
};
