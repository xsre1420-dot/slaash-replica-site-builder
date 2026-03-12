import { useState, useEffect, useCallback, useRef } from "react";
import { Order } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapDbOrder } from "@/hooks/useOrderData";
import { format } from "date-fns";
import { cache, CacheKeys, CacheTTL, dedup } from "@/lib/cache";
import { useAuth } from "@/context/AuthContext";

const ORDERS_PER_PAGE = 50;

export const useOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const fetchOrders = useCallback(async (page = 0, append = false) => {
    if (!append) setLoading(true);
    
    const ownerId = user?.id || 'anon';
    const cacheKey = CacheKeys.orders(ownerId, page);

    // Check cache for this page
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

    const from = page * ORDERS_PER_PAGE;
    const to = from + ORDERS_PER_PAGE - 1;

    // Deduplicate concurrent fetches for same page
    const mapped = await dedup(`fetch-orders-${page}`, async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, total, delivery_fee, created_at, updated_at, customer_name, customer_phone, customer_address, customer_governorate, items, notes')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error || !data) return [];
      return data.map(mapDbOrder);
    });

    // Cache this page
    cache.set(cacheKey, mapped, CacheTTL.SHORT, CacheTTL.STALE);

    if (append) {
      setOrders(prev => [...prev, ...mapped]);
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
      cache.flushByPrefix('orders:');
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: "pending" | "completed" | "cancelled") => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      // Invalidate orders & statistics cache on status change
      cache.flushByPrefix('orders:');
      cache.flushByPrefix('stats:');
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
    refetch: () => { cache.flushByPrefix('orders:'); fetchOrders(0); },
  };
};
