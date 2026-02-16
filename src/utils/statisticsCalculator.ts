
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
      { name: "الدفع عند الاستلام", value: 0, color: "hsl(248, 53%, 58%)" },
      { name: "بطاقة ائتمان", value: 0, color: "hsl(248, 53%, 68%)" },
      { name: "محفظة رقمية", value: 0, color: "hsl(220, 9%, 46%)" }
    ],
    peakTimes: []
  };
};

// Calculate growth by comparing current period with previous period
const calculateGrowthRate = (orders: any[], visits: any[], dateRange: string) => {
  const days = parseInt(dateRange);
  const now = new Date();
  const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

  const currentOrders = orders.filter(o => new Date(o.created_at) >= currentStart);
  const previousOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    return d >= previousStart && d < currentStart;
  });

  const currentRevenue = currentOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
  const previousRevenue = previousOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

  const currentVisits = visits.filter(v => new Date(v.created_at) >= currentStart).length;
  const previousVisits = visits.filter(v => {
    const d = new Date(v.created_at);
    return d >= previousStart && d < currentStart;
  }).length;

  const growthCalc = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return {
    revenueGrowth: growthCalc(currentRevenue, previousRevenue),
    ordersGrowth: growthCalc(currentOrders.length, previousOrders.length),
    visitorsGrowth: growthCalc(currentVisits, previousVisits),
  };
};

export const calculateStatistics = (data: DatabaseData, dateRange: string = "7"): RealStatistics => {
  const { orders, orderItems, customers, products, visits } = data;

  if (orders.length === 0 && orderItems.length === 0 && customers.length === 0 && products.length === 0) {
    return getDefaultStatistics();
  }

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
  const totalVisitors = visits.length;
  const totalProducts = products.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const conversionRate = totalVisitors > 0 ? (totalOrders / totalVisitors) * 100 : 0;

  const newCustomers = customers.filter(c => c.total_orders === 1).length;
  const returningCustomers = customers.filter(c => c.total_orders > 1).length;

  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const cancelledOrdersRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

  const deliveryTimes = orders.filter(o => o.delivery_time).map(o => o.delivery_time);
  const averageDeliveryTime = deliveryTimes.length > 0 ? 
    deliveryTimes.reduce((sum: number, time: number) => sum + time, 0) / deliveryTimes.length : 0;

  // Real growth calculations
  const growth = calculateGrowthRate(orders, visits, dateRange);

  // Top products
  const productSales: { [key: string]: { name: string; orders: number; revenue: number } } = {};
  orderItems.forEach(item => {
    const productName = item.product_name || 'منتج غير معروف';
    if (!productSales[productName]) {
      productSales[productName] = { name: productName, orders: 0, revenue: 0 };
    }
    productSales[productName].orders += item.quantity || 1;
    productSales[productName].revenue += parseFloat(item.subtotal || 0);
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6)
    .map(product => ({
      ...product,
      percentage: totalOrders > 0 ? (product.orders / totalOrders) * 100 : 0
    }));

  // Payment methods
  const paymentMethodCounts: { [key: string]: number } = {};
  orders.forEach(order => {
    const method = order.payment_method || 'cash_on_delivery';
    paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
  });

  const paymentMethods = [
    { name: "الدفع عند الاستلام", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.cash_on_delivery || 0) / totalOrders) * 100) : 0, color: "hsl(248, 53%, 58%)" },
    { name: "بطاقة ائتمان", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.credit_card || 0) / totalOrders) * 100) : 0, color: "hsl(248, 53%, 68%)" },
    { name: "محفظة رقمية", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.digital_wallet || 0) / totalOrders) * 100) : 0, color: "hsl(220, 9%, 46%)" },
  ];

  // Peak times
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
    .slice(0, 1);

  return {
    totalRevenue,
    totalOrders,
    totalVisitors,
    totalProducts,
    averageOrderValue,
    conversionRate,
    visitorsGrowth: growth.visitorsGrowth,
    ordersGrowth: growth.ordersGrowth,
    revenueGrowth: growth.revenueGrowth,
    productsGrowth: 0,
    newCustomers,
    returningCustomers,
    cartAbandonmentRate: 0,
    averageDeliveryTime,
    cancelledOrdersRate,
    topProducts,
    paymentMethods,
    peakTimes
  };
};
