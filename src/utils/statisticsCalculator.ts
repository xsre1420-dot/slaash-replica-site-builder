
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
    topViewedProducts: [],
    campaignAttribution: [],
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

const num = (value: unknown): number | null =>
  value != null && value !== '' ? Number(value) : null;

/** Prefer KPI when present; if KPI is 0 but client has data, trust client (broken/stale RPC). */
const mergeMetric = (kpi: number | null, client: number): number => {
  if (kpi == null) return client;
  if (kpi === 0 && client > 0) return client;
  return kpi;
};

const growthCalc = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export const calculateStatistics = (
  data: DatabaseData,
  bounds?: StatisticsDateBounds
): RealStatistics => {
  const { orders, orderItems, products, visits, kpis, previousKpis } = data;
  const periodBounds = bounds || data.dateBounds;

  if (!periodBounds) {
    return getDefaultStatistics();
  }

  const { start, end } = periodBounds;
  const periodOrders = orders.filter(o => inPeriod(o.created_at, start, end));
  const periodVisits = visits.filter(v => inPeriod(v.created_at, start, end));
  const isNetCompletedOrder = (o: (typeof orders)[number]) =>
    o.status === 'completed' && o.payment_status !== 'refunded';
  const completedOrders = periodOrders.filter(isNetCompletedOrder);
  const completedOrderIds = new Set(completedOrders.map(o => o.id));
  const periodItems = orderItems.filter(i => completedOrderIds.has(i.order_id));

  const kpiOrderCount = num(kpis?.order_count);
  const kpiRevenue = num(kpis?.completed_revenue);
  const kpiRefunds = num(kpis?.refund_total) ?? 0;
  const kpiUniqueVisitors = num(kpis?.unique_visitors);
  const kpiProductCount = num(kpis?.product_count);
  const kpiNewCustomers = num(kpis?.new_customers);
  const kpiReturningCustomers = num(kpis?.returning_customers);

  const clientOrderCount = periodOrders.filter(o => o.status !== 'cancelled').length;
  const clientRevenue = completedOrders.reduce(
    (sum, order) => sum + parseFloat(order.total_amount || 0),
    0
  );
  const clientUniqueVisitors = new Set(
    periodVisits.map(v => v.visitor_ip).filter(Boolean)
  ).size;

  const totalOrders = mergeMetric(kpiOrderCount, clientOrderCount);
  const grossRevenue = mergeMetric(kpiRevenue, clientRevenue);
  const totalRevenue = Math.max(0, grossRevenue - kpiRefunds);
  const totalVisitors = mergeMetric(kpiUniqueVisitors, clientUniqueVisitors);
  const totalProducts = mergeMetric(kpiProductCount, products.length);
  const completedCount = completedOrders.length;
  const kpiCompletedOrderCount = num(kpis?.completed_order_count);
  const completedCountForConversion = kpiCompletedOrderCount ?? completedOrders.length;
  const averageOrderValue = completedCount > 0 ? totalRevenue / completedCount : 0;
  const conversionRate = totalVisitors > 0 ? (completedCountForConversion / totalVisitors) * 100 : 0;

  const newCustomers = kpiNewCustomers ?? (() => {
    const phones = new Map<string, number>();
    periodOrders.forEach(o => {
      if (o.customer_phone) phones.set(o.customer_phone, (phones.get(o.customer_phone) || 0) + 1);
    });
    return [...phones.values()].filter(c => c === 1).length;
  })();

  const returningCustomers = kpiReturningCustomers ?? (() => {
    const phones = new Map<string, number>();
    periodOrders.forEach(o => {
      if (o.customer_phone) phones.set(o.customer_phone, (phones.get(o.customer_phone) || 0) + 1);
    });
    return [...phones.values()].filter(c => c > 1).length;
  })();

  const cancelledOrders = periodOrders.filter(o => o.status === 'cancelled').length;
  const cancelledOrdersRate = periodOrders.length > 0 ? (cancelledOrders / periodOrders.length) * 100 : 0;

  const prevOrderCount = num(previousKpis?.order_count);
  const prevRevenue = num(previousKpis?.completed_revenue);
  const prevRefunds = num(previousKpis?.refund_total) ?? 0;
  const prevVisitors = num(previousKpis?.unique_visitors);

  const previousPeriodOrders = orders.filter(o => inPeriod(o.created_at, periodBounds.previousStart, start));
  const previousCompletedRevenue = previousPeriodOrders
    .filter(isNetCompletedOrder)
    .reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
  const previousOrderCountClient = previousPeriodOrders.filter(o => o.status !== 'cancelled').length;
  const previousVisitorsClient = new Set(
    visits
      .filter(v => inPeriod(v.created_at, periodBounds.previousStart, start))
      .map(v => v.visitor_ip)
      .filter(Boolean)
  ).size;

  const revenueGrowth = growthCalc(
    totalRevenue,
    prevRevenue != null ? Math.max(0, prevRevenue - prevRefunds) : previousCompletedRevenue
  );
  const ordersGrowth = growthCalc(
    totalOrders,
    mergeMetric(prevOrderCount, previousOrderCountClient)
  );
  const visitorsGrowth = growthCalc(
    totalVisitors,
    mergeMetric(prevVisitors, previousVisitorsClient)
  );

  const rawTopSelling = Array.isArray(kpis?.top_selling_products) ? kpis.top_selling_products : [];
  const topProductsFromKpi = (rawTopSelling as Array<{
    product_name?: string;
    units?: number;
    revenue?: number;
  }>)
    .map((row) => ({
      name: String(row.product_name || 'منتج'),
      orders: Number(row.units || 0),
      revenue: Number(row.revenue || 0),
    }))
    .filter((p) => p.revenue > 0 || p.orders > 0);

  const topProducts = topProductsFromKpi.length > 0
    ? topProductsFromKpi.slice(0, 6).map((product) => ({
        ...product,
        percentage: totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0,
      }))
    : (() => {
        const productSales: { [key: string]: { name: string; orders: number; revenue: number } } = {};
        periodItems.forEach(item => {
          const productName = item.product_name || 'منتج غير معروف';
          if (!productSales[productName]) {
            productSales[productName] = { name: productName, orders: 0, revenue: 0 };
          }
          productSales[productName].orders += item.quantity || 1;
          productSales[productName].revenue += parseFloat(item.subtotal || 0);
        });

        return Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 6)
          .map(product => ({
            ...product,
            percentage: totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0
          }));
      })();

  const rawTopViewed = Array.isArray(kpis?.top_viewed_products) ? kpis.top_viewed_products : [];
  const topViewedProducts = (rawTopViewed as Array<{ product_id?: string; product_name?: string; view_count?: number }>)
    .map((row) => ({
      productId: String(row.product_id || ''),
      name: String(row.product_name || 'منتج'),
      views: Number(row.view_count || 0),
      percentage: 0,
    }))
    .filter((p) => p.productId && p.views > 0);

  const totalViews = topViewedProducts.reduce((sum, p) => sum + p.views, 0);
  topViewedProducts.forEach((p) => {
    p.percentage = totalViews > 0 ? (p.views / totalViews) * 100 : 0;
  });

  const rawCampaigns = Array.isArray(kpis?.campaign_attribution) ? kpis.campaign_attribution : [];
  const campaignAttribution = (rawCampaigns as Array<{
    source?: string;
    medium?: string;
    campaign?: string;
    orders?: number;
    revenue?: number;
  }>).map((row) => ({
    source: String(row.source || '(direct)'),
    medium: String(row.medium || '(none)'),
    campaign: String(row.campaign || '(none)'),
    orders: Number(row.orders || 0),
    revenue: Number(row.revenue || 0),
  }));

  const paymentMethodCounts: { [key: string]: number } = {};
  periodOrders.filter(o => o.status !== 'cancelled').forEach(order => {
    const method = order.payment_method || 'cash_on_delivery';
    paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
  });

  const paymentOrders = totalOrders || 1;
  const paymentMethods = [
    { name: "الدفع عند الاستلام", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.cash_on_delivery || 0) / paymentOrders) * 100) : 0, color: "hsl(248, 53%, 58%)" },
    { name: "بطاقة ائتمان", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.credit_card || 0) / paymentOrders) * 100) : 0, color: "hsl(248, 53%, 68%)" },
    { name: "محفظة رقمية", value: totalOrders > 0 ? Math.round(((paymentMethodCounts.digital_wallet || 0) / paymentOrders) * 100) : 0, color: "hsl(220, 9%, 46%)" },
  ];

  const hourCounts: { [key: number]: number } = {};
  completedOrders.forEach(order => {
    const hour = new Date(order.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakTimes = Object.entries(hourCounts)
    .map(([hour, count]) => ({
      time: `${hour}:00 - ${parseInt(hour, 10) + 1}:00`,
      orders: count,
      percentage: completedCount > 0 ? (count / completedCount) * 100 : 0
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
    visitorsGrowth,
    ordersGrowth,
    revenueGrowth,
    productsGrowth: 0,
    newCustomers,
    returningCustomers,
    cartAbandonmentRate: 0,
    averageDeliveryTime: 0,
    cancelledOrdersRate,
    topProducts,
    topViewedProducts,
    campaignAttribution,
    paymentMethods,
    peakTimes
  };
};
