
import { useState, useEffect } from "react";
import { Order } from "@/types";
import { format } from "date-fns";

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

  useEffect(() => {
    // Load orders from localStorage only - no demo data
    const storedOrders = localStorage.getItem('orders');
    if (storedOrders) {
      try {
        const parsedOrders = JSON.parse(storedOrders);
        setOrders(parsedOrders);
        setFilteredOrders(parsedOrders);
      } catch (error) {
        console.error('Error parsing stored orders:', error);
        setOrders([]);
        setFilteredOrders([]);
      }
    } else {
      // Start with empty orders array
      setOrders([]);
      setFilteredOrders([]);
    }
  }, []);

  useEffect(() => {
    filterOrders();
  }, [searchQuery, dateFilter, orders]);

  const filterOrders = () => {
    let filtered = [...orders];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (order) =>
          order.customerInfo.name.includes(searchQuery) ||
          order.customerInfo.phone.includes(searchQuery) ||
          order.id.includes(searchQuery)
      );
    }

    // Filter by date
    if (dateFilter) {
      const filterDate = format(dateFilter, "yyyy-MM-dd");
      filtered = filtered.filter((order) => 
        order.date.startsWith(filterDate)
      );
    }

    setFilteredOrders(filtered);
  };

  const archiveOrder = (orderId: string) => {
    const updatedOrders = orders.map((order) =>
      order.id === orderId ? { ...order, status: "cancelled" as "pending" | "completed" | "cancelled" } : order
    );
    setOrders(updatedOrders);
    updateLocalStorage(updatedOrders);
  };

  const updateOrderStatus = (orderId: string, newStatus: "pending" | "completed" | "cancelled") => {
    const updatedOrders = orders.map((order) =>
      order.id === orderId ? { ...order, status: newStatus } : order
    );
    setOrders(updatedOrders);
    updateLocalStorage(updatedOrders);
  };

  const updateLocalStorage = (updatedOrders: Order[]) => {
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
  };

  const clearDateFilter = () => {
    setDateFilter(undefined);
  };

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
  };
};
