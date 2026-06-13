
export interface RealStatistics {
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
  cartAbandonmentRate: number;
  averageDeliveryTime: number;
  cancelledOrdersRate: number;
  topProducts: Array<{
    name: string;
    orders: number;
    revenue: number;
    percentage: number;
  }>;
  topViewedProducts: Array<{
    productId: string;
    name: string;
    views: number;
    percentage: number;
  }>;
  campaignAttribution: Array<{
    source: string;
    medium: string;
    campaign: string;
    orders: number;
    revenue: number;
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

export interface StatisticsDateBounds {
  start: Date;
  end: Date;
  days: number;
  previousStart: Date;
}

export interface DatabaseData {
  orders: any[];
  orderItems: any[];
  customers: any[];
  products: any[];
  visits: any[];
  kpis?: Record<string, unknown>;
  previousKpis?: Record<string, unknown>;
  truncated?: boolean;
  dateBounds?: StatisticsDateBounds;
}
