
import { useState, useEffect } from "react";
import { Order } from "@/types";
import { format } from "date-fns";

// Demo orders data
const demoOrders: Order[] = [
  {
    id: "ord-001",
    items: [
      {
        product: {
          id: "p1",
          name: "برجر لحم",
          description: "برجر لحم مشوي مع صوص خاص",
          category: "وجبات سريعة",
          price: 8000,
          image: "/placeholder.svg",
        },
        quantity: 2,
      },
      {
        product: {
          id: "p2",
          name: "بطاطس",
          description: "بطاطس مقلية مقرمشة",
          category: "إضافات",
          price: 3000,
          image: "/placeholder.svg",
        },
        quantity: 1,
      },
    ],
    customerInfo: {
      name: "أحمد محمد",
      phone: "07701234567",
      address: "بغداد - الكرادة",
      notes: "الرجاء التوصيل سريعاً",
    },
    total: 19000,
    date: "2025-05-03T14:30:00",
    status: "completed",
  },
  {
    id: "ord-002",
    items: [
      {
        product: {
          id: "p3",
          name: "شاورما دجاج",
          description: "شاورما دجاج مع صوص ثوم",
          category: "وجبات سريعة",
          price: 6000,
          image: "/placeholder.svg",
        },
        quantity: 3,
      },
    ],
    customerInfo: {
      name: "سارة علي",
      phone: "07709876543",
      address: "بغداد - المنصور",
    },
    total: 18000,
    date: "2025-05-02T19:45:00",
    status: "completed",
  },
  {
    id: "ord-003",
    items: [
      {
        product: {
          id: "p4",
          name: "معجنات مشكلة",
          description: "تشكيلة من المعجنات الطازجة",
          category: "معجنات",
          price: 12000,
          image: "/placeholder.svg",
        },
        quantity: 1,
      },
    ],
    customerInfo: {
      name: "محمد حسين",
      phone: "07712345678",
      address: "بغداد - زيونة",
    },
    total: 12000,
    date: "2025-05-01T11:15:00",
    status: "pending",
  },
];

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

  useEffect(() => {
    // Try to get orders from localStorage first
    const storedOrders = localStorage.getItem('orders');
    if (storedOrders) {
      try {
        const parsedOrders = JSON.parse(storedOrders);
        // Combine stored orders with demo orders
        setOrders([...parsedOrders, ...demoOrders]);
        setFilteredOrders([...parsedOrders, ...demoOrders]);
      } catch (error) {
        console.error('Error parsing stored orders:', error);
        setOrders(demoOrders);
        setFilteredOrders(demoOrders);
      }
    } else {
      // Fall back to demo orders
      setOrders(demoOrders);
      setFilteredOrders(demoOrders);
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
    
    // Update localStorage if order is from there
    const storedOrders = localStorage.getItem('orders');
    if (storedOrders) {
      try {
        const parsedOrders = JSON.parse(storedOrders);
        const updatedStoredOrders = parsedOrders.map((order: Order) =>
          order.id === orderId ? { ...order, status: "cancelled" as "pending" | "completed" | "cancelled" } : order
        );
        localStorage.setItem('orders', JSON.stringify(updatedStoredOrders));
      } catch (error) {
        console.error('Error updating stored orders:', error);
      }
    }
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
    clearDateFilter,
  };
};
