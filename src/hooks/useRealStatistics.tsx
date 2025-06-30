import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RealStatistics {
  totalRevenue: number;
  totalOrders: number;
  totalVisitors: number;
  totalProducts: number;
  averageOrderValue: number;
  conversionRate: number;
  visitorsGrowth: number;
  ordersGrowth: number;
  revenueGrowth: number;
  productsGrowth: number;
  newCustomers: number;
  returningCustomers: number;
  customerLifetimeValue: number;
  cartAbandonmentRate: number;
  averageDeliveryTime: number;
  cancelledOrdersRate: number;
  topProducts: Array<{
    name: string;
    orders: number;
    revenue: number;
    percentage: number;
  }>;
  paymentMethods: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  peakTimes: Array<{
    time: string;
    orders: number;
    percentage: number;
  }>;
}

export const useRealStatistics = (dateRange: string = "7") => {
  const [stats, setStats] = useState<RealStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRealStatistics();
  }, [dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    const days = parseInt(dateRange);
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return startDate.toISOString();
  };

  const fetchRealStatistics = async () => {
    setLoading(true);
    setError(null);

    try {
      const dateFilter = getDateFilter();
      
      // Fetch orders data (all orders from all owners)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', dateFilter);

      if (ordersError) throw ordersError;

      // Fetch order items data (all order items)
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('*, orders!inner(*)')
        .gte('orders.created_at', dateFilter);

      if (itemsError) throw itemsError;

      // Fetch customers data (all customers)
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*');

      if (customersError) throw customersError;

      // Fetch products data (all products)
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*');

      if (productsError) throw productsError;

      // Fetch store visits data (all visits)
      const { data: visits, error: visitsError } = await supabase
        .from('store_visits')
        .select('*')
        .gte('created_at', dateFilter);

      if (visitsError) throw visitsError;

      // Calculate statistics
      const calculatedStats = calculateStatistics(
        orders || [],
        orderItems || [],
        customers || [],
        products || [],
        visits || []
      );

      setStats(calculatedStats);
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError('فشل في تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (orders: any[], orderItems: any[], customers: any[], products: any[], visits: any[]): RealStatistics => {
    // Basic calculations
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
    const totalVisitors = visits.length;
    const totalProducts = products.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = totalVisitors > 0 ? (totalOrders / totalVisitors) * 100 : 0;

    // Customer calculations
    const newCustomers = customers.filter(customer => customer.total_orders === 1).length;
    const returningCustomers = customers.filter(customer => customer.total_orders > 1).length;
    const customerLifetimeValue = customers.length > 0 ? 
      customers.reduce((sum, customer) => sum + parseFloat(customer.total_spent || 0), 0) / customers.length : 0;

    // Order status calculations
    const completedOrders = orders.filter(order => order.status === 'completed').length;
    const cancelledOrders = orders.filter(order => order.status === 'cancelled').length;
    const cancelledOrdersRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    // Average delivery time
    const deliveryTimes = orders.filter(order => order.delivery_time).map(order => order.delivery_time);
    const averageDeliveryTime = deliveryTimes.length > 0 ? 
      deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length : 30;

    // Top products calculation
    const productSales: { [key: string]: { name: string; orders: number; revenue: number } } = {};
    
    orderItems.forEach(item => {
      const productName = item.product_name;
      if (!productSales[productName]) {
        productSales[productName] = { name: productName, orders: 0, revenue: 0 };
      }
      productSales[productName].orders += item.quantity;
      productSales[productName].revenue += parseFloat(item.subtotal || 0);
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 6)
      .map(product => ({
        ...product,
        percentage: totalOrders > 0 ? (product.orders / totalOrders) * 100 : 0
      }));

    // Payment methods calculation
    const paymentMethodCounts: { [key: string]: number } = {};
    orders.forEach(order => {
      const method = order.payment_method || 'cash_on_delivery';
      paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
    });

    const paymentMethods = [
      { 
        name: "الدفع عند الاستلام", 
        value: Math.round(((paymentMethodCounts.cash_on_delivery || 0) / totalOrders) * 100) || 0,
        color: "#6D63F2" 
      },
      { 
        name: "بطاقة ائتمان", 
        value: Math.round(((paymentMethodCounts.credit_card || 0) / totalOrders) * 100) || 0,
        color: "#8B5CF6" 
      },
      { 
        name: "محفظة رقمية", 
        value: Math.round(((paymentMethodCounts.digital_wallet || 0) / totalOrders) * 100) || 0,
        color: "#A855F7" 
      },
    ];

    // Peak times calculation
    const hourCounts: { [key: number]: number } = {};
    orders.forEach(order => {
      const hour = new Date(order.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakTimes = Object.entries(hourCounts)
      .map(([hour, count]) => ({
        time: `${hour}:00 - ${parseInt(hour) + 1}:00`,
        orders: count,
        percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    return {
      totalRevenue,
      totalOrders,
      totalVisitors: totalVisitors || 0,
      totalProducts,
      averageOrderValue,
      conversionRate,
      visitorsGrowth: 0, // This would require historical data comparison
      ordersGrowth: 0,
      revenueGrowth: 0,
      productsGrowth: 0,
      newCustomers,
      returningCustomers,
      customerLifetimeValue,
      cartAbandonmentRate: 0, // This would require cart tracking
      averageDeliveryTime,
      cancelledOrdersRate,
      topProducts,
      paymentMethods,
      peakTimes
    };
  };

  return { stats, loading, error, refetch: fetchRealStatistics };
};
