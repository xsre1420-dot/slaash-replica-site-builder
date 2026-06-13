
import { RealStatistics, DatabaseData } from "@/types/statistics";
import type { StatisticsDateBounds } from "@/services/statisticsService";

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

const inPeriod = (createdAt: string, start: Date, end: Date) => {
  const d = new Date(createdAt);
  return d >= start && d <= end;
};

const calculateGrowthRate = (
  orders: any[],
  visits: any[],
  bounds: StatisticsDateBounds
) => {
  const { start, end, previousStart } = bounds;

  const currentOrders = orders.filter(o => inPeriod(o.created_at, start, end));
  const previousOrders = orders.filter(o => inPeriod(o.created_at, previousStart, start));

  const currentRevenue = currentOrders
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
  const previousRevenue = previousOrders
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

  const currentVisits = visits.filter(v => inPeriod(v.created_at, start, end)).length;
  const previousVisits = visits.filter(v => inPeriod(v.created_at, previousStart, start)).length;

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

export const calculateStatistics = (
  data: DatabaseData,
  bounds?: StatisticsDateBounds
): RealStatistics => {
  const { orders, orderItems, products, visits, kpis } = data;
  const periodBounds = bounds || data.dateBounds;

  if (!periodBounds) {
    return getDefaultStatistics();
  }

  const { start, end } = periodBounds;
  const periodOrders = orders.filter(o => inPeriod(o.created_at, start, end));
  const periodVisits = visits.filter(v => inPeriod(v.created_at, start, end));
  const periodOrderIds = new Set(periodOrders.map(o => o.id));
  const periodItems = orderItems.filter(i => periodOrderIds.has(i.order_id));

  if (periodOrders.length === 0 && periodItems.length === 0 && periodVisits.length === 0) {
    return getDefaultStatistics();
  }

  const kpiRevenue = kpis?.completed_revenue != null ? Number(kpis.completed_revenue) : null;
  const kpiOrderCount = kpis?.order_count != null ? Number(kpis.order_count) : null;
  const kpiProductCount = kpis?.product_count != null ? Number(kpis.product_count) : null;

  const completedOrders = periodOrders.filter(o => o.status === 'completed');
  const totalOrders = kpiOrderCount ?? periodOrders.filter(o => o.status !== 'cancelled').length;
  const totalRevenue = kpiRevenue ?? completedOrders.reduce(
    (sum, order) => sum + parseFloat(order.total_amount || 0),
    0
  );
  const totalVisitors = periodVisits.length;
  const totalProducts = kpiProductCount ?? products.length;
  const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const conversionRate = totalVisitors > 0 ? (totalOrders / totalVisitors) * 100 : 0;

  const customerPhones = new Map<string, number>();
  periodOrders.forEach(o => {
    const phone = o.customer_phone;
    if (phone) customerPhones.set(phone, (customerPhones.get(phone) || 0) + 1);
  });
  const newCustomers = [...customerPhones.values()].filter(c => c === 1).length;
  const returningCustomers = [...customerPhones.values()].filter(c => c > 1).length;

  const cancelledOrders = periodOrders.filter(o => o.status === 'cancelled').length;
  const cancelledOrdersRate = periodOrders.length > 0 ? (cancelledOrders / periodOrders.length) * 100 : 0;

  const growth = calculateGrowthRate(orders, visits, periodBounds);

  const productSales: { [key: string]: { name: string; orders: number; revenue: number } } = {};
  periodItems.forEach(item => {
    const productName = item.product_name || 'منتج غير معروف';
    if (!productSales[productName]) {
      productSales[productName] = { name: productName, orders: 0, revenue: 0 };
    }
    productSales[productName].orders += item.quantity || 1;
    productSales[productName].revenue += parseFloat(item.subtotal || 0);
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map(product => ({
      ...product,
      percentage: totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0
    }));

  const paymentMethodCounts: { [key: string]: number } = {};
  periodOrders.forEach(order => {
    const method = order.payment_method || 'cash_on_delivery';
    paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
  });

  const paymentMethods = [
    { name: "الدفع عند الاستلام", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.cash_on_delivery || 0) / totalOrders) * 100) : 0, color: "hsl(248, 53%, 58%)" },
    { name: "بطاقة ائتمان", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.credit_card || 0) / totalOrders) * 100) : 0, color: "hsl(248, 53%, 68%)" },
    { name: "محفظة رقمية", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.digital_wallet || 0) / totalOrders) * 100) : 0, color: "hsl(220, 9%, 46%)" },
  ];

  const hourCounts: { [key: number]: number } = {};
  periodOrders.forEach(order => {
    const hour = new Date(order.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakTimes = Object.entries(hourCounts)
    .map(([hour, count]) => ({
      time: `${hour}:00 - ${parseInt(hour, 10) + 1}:00`,
      orders: count,
      percentage: periodOrders.length > 0 ? (count / periodOrders.length) * 100 : 0
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
    averageDeliveryTime: 0,
    cancelledOrdersRate,
    topProducts,
    paymentMethods,
    peakTimes
  };
};
