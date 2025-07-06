import { useState, useEffect } from "react";
import { Order } from "@/types";
import { demoOrders } from "@/data/demoOrders";

export const useOrderData = (orderId: string | undefined) => {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    // Try to get orders from localStorage first
    const storedOrders = localStorage.getItem('orders');
    let foundOrder = null;
    
    if (storedOrders) {
      try {
        const parsedOrders = JSON.parse(storedOrders);
        foundOrder = parsedOrders.find((o: Order) => o.id === orderId);
      } catch (error) {
        console.error('Error parsing stored orders:', error);
      }
    }
    
    // If not found in localStorage, check demo orders
    if (!foundOrder) {
      foundOrder = demoOrders.find((o) => o.id === orderId);
    }
    
    if (foundOrder) {
      setOrder(foundOrder);
    }
  }, [orderId]);

  return { order };
};