import { describe, it, expect } from 'vitest';
import { Product } from '@/types';
import {
  computePeriodMetricsFromOrders,
  formatKpiTrend,
  getInventoryAlertStatus,
  isCompletedRevenueOrder,
  summarizeInventoryAlerts,
} from './dashboardInsightsUtils';

describe('dashboardInsightsUtils', () => {
  const orders: Order[] = [
    {
      id: '1',
      status: 'completed',
      total: 100,
      paymentStatus: 'collected',
      date: new Date().toISOString(),
      customerInfo: { name: 'a', phone: '1', address: '' },
      items: [],
    },
    {
      id: '2',
      status: 'pending',
      total: 50,
      date: new Date().toISOString(),
      customerInfo: { name: 'b', phone: '2', address: '' },
      items: [],
    },
  ];

  it('counts today orders and completed revenue', () => {
    const metrics = computePeriodMetricsFromOrders(orders, { today: true });
    expect(metrics.orders).toBe(2);
    expect(metrics.revenue).toBe(100);
  });

  it('detects completed revenue orders', () => {
    expect(isCompletedRevenueOrder(orders[0])).toBe(true);
    expect(isCompletedRevenueOrder(orders[1])).toBe(false);
  });

  it('formats KPI trend with orders and percentage', () => {
    const trend = formatKpiTrend(200, 100, 3);
    expect(trend.trend).toContain('3 طلبات');
    expect(trend.trend).toContain('+100%');
    expect(trend.trendUp).toBe(true);
  });

  it('detects low and out inventory using variant qty', () => {
    const product: Product = {
      id: '1',
      name: 'P',
      description: '',
      category: 'c',
      price: 10,
      image: '',
      stockQuantity: 0,
      variants: [{ quantity: 2 }],
      isActive: true,
    };
    expect(getInventoryAlertStatus(product)).toBe('low');

    const out: Product = { ...product, variants: [{ quantity: 0 }] };
    expect(getInventoryAlertStatus(out)).toBe('out');

    const summary = summarizeInventoryAlerts([product, out]);
    expect(summary.total).toBe(2);
  });
});
