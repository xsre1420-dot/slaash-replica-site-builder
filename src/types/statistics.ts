
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

export interface DatabaseData {
  orders: any[];
  orderItems: any[];
  customers: any[];
  products: any[];
  visits: any[];
}
