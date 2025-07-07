
import { RealStatistics, DatabaseData } from "@/types/statistics";

export const getDefaultStatistics = (): RealStatistics => {
  return {
    totalRevenue: 0,
    totalOrders: 0,
    totalVisitors: 0,
    totalProducts: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    visitorsGrowth: 0,
    ordersGrowth: 0,
    revenueGrowth: 0,
    productsGrowth: 0,
    newCustomers: 0,
    returningCustomers: 0,
    cartAbandonmentRate: 0,
    averageDeliveryTime: 0,
    cancelledOrdersRate: 0,
    topProducts: [],
    paymentMethods: [
      { name: "الدفع عند الاستلام", value: 0, color: "#6D63F2" },
      { name: "بطاقة ائتمان", value: 0, color: "#8B5CF6" },
      { name: "محفظة رقمية", value: 0, color: "#A855F7" }
    ],
    peakTimes: []
  };
};

export const calculateStatistics = (data: DatabaseData): RealStatistics => {
  const { orders, orderItems, customers, products, visits } = data;

  console.log('Calculating statistics with data:', {
    ordersCount: orders.length,
    orderItemsCount: orderItems.length,
    customersCount: customers.length,
    productsCount: products.length,
    visitsCount: visits.length
  });

  // If no data exists, return default statistics
  if (orders.length === 0 && orderItems.length === 0 && customers.length === 0 && products.length === 0) {
    console.log('No data found, returning default statistics');
    return getDefaultStatistics();
  }

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

  // Order status calculations
  const cancelledOrders = orders.filter(order => order.status === 'cancelled').length;
  const cancelledOrdersRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

  // Average delivery time
  const deliveryTimes = orders.filter(order => order.delivery_time).map(order => order.delivery_time);
  const averageDeliveryTime = deliveryTimes.length > 0 ? 
    deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length : 0;

  // Top products calculation
  const productSales: { [key: string]: { name: string; orders: number; revenue: number } } = {};
  
  orderItems.forEach(item => {
    const productName = item.product_name || 'منتج غير معروف';
    if (!productSales[productName]) {
      productSales[productName] = { name: productName, orders: 0, revenue: 0 };
    }
    productSales[productName].orders += item.quantity || 1;
    productSales[productName].revenue += parseFloat(item.subtotal || 0);
  });

  let topProducts = Object.values(productSales)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6)
    .map(product => ({
      ...product,
      percentage: totalOrders > 0 ? (product.orders / totalOrders) * 100 : 0
    }));

  // Add default products if none exist
  if (topProducts.length === 0) {
    topProducts = [];
  }

  // Payment methods calculation
  const paymentMethodCounts: { [key: string]: number } = {};
  orders.forEach(order => {
    const method = order.payment_method || 'cash_on_delivery';
    paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
  });

  const paymentMethods = [
    { 
      name: "الدفع عند الاستلام", 
      value: totalOrders > 0 ? Math.round(((paymentMethodCounts.cash_on_delivery || 0) / totalOrders) * 100) : 0,
      color: "#6D63F2" 
    },
    { 
      name: "بطاقة ائتمان", 
      value: totalOrders > 0 ? Math.round(((paymentMethodCounts.credit_card || 0) / totalOrders) * 100) : 0,
      color: "#8B5CF6" 
    },
    { 
      name: "محفظة رقمية", 
      value: totalOrders > 0 ? Math.round(((paymentMethodCounts.digital_wallet || 0) / totalOrders) * 100) : 0,
      color: "#A855F7" 
    },
  ];

  // Peak times calculation - show only the top one
  const hourCounts: { [key: number]: number } = {};
  orders.forEach(order => {
    const hour = new Date(order.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  let peakTimes = Object.entries(hourCounts)
    .map(([hour, count]) => ({
      time: `${hour}:00 - ${parseInt(hour) + 1}:00`,
      orders: count,
      percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 1); // Only show the top peak time

  // Add default peak time if none exist
  if (peakTimes.length === 0) {
    peakTimes = [];
  }

  const finalStats = {
    totalRevenue: totalRevenue,
    totalOrders: totalOrders,
    totalVisitors: totalVisitors,
    totalProducts: totalProducts,
    averageOrderValue: averageOrderValue,
    conversionRate: conversionRate,
    visitorsGrowth: 0,
    ordersGrowth: 0,
    revenueGrowth: 0,
    productsGrowth: 0,
    newCustomers: newCustomers,
    returningCustomers: returningCustomers,
    cartAbandonmentRate: 0,
    averageDeliveryTime: averageDeliveryTime,
    cancelledOrdersRate: cancelledOrdersRate,
    topProducts,
    paymentMethods,
    peakTimes
  };

  console.log('Final calculated stats:', finalStats);
  return finalStats;
};
