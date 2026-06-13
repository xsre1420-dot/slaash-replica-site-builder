import { describe, it, expect } from 'vitest';
import { calculateStatistics } from './statisticsCalculator';
import type { DatabaseData } from '@/types/statistics';
import type { StatisticsDateBounds } from '@/services/statisticsService';

const bounds: StatisticsDateBounds = {
  start: new Date('2026-06-01T00:00:00'),
  end: new Date('2026-06-07T23:59:59.999'),
  days: 7,
  previousStart: new Date('2026-05-25T00:00:00'),
};

describe('calculateStatistics', () => {
  it('uses KPI revenue minus refunds and excludes cancelled from order count', () => {
    const data: DatabaseData = {
      orders: [
        { id: '1', status: 'completed', total_amount: '100', created_at: '2026-06-02T10:00:00Z', customer_phone: '1' },
        { id: '2', status: 'cancelled', total_amount: '50', created_at: '2026-06-03T10:00:00Z', customer_phone: '2' },
        { id: '3', status: 'pending', total_amount: '80', created_at: '2026-06-04T10:00:00Z', customer_phone: '3' },
      ],
      orderItems: [
        { order_id: '1', product_name: 'A', quantity: 1, subtotal: '100' },
        { order_id: '3', product_name: 'B', quantity: 1, subtotal: '80' },
      ],
      customers: [],
      products: [null, null],
      visits: [{ id: 'v1', created_at: '2026-06-02T10:00:00Z', visitor_ip: '1.2.3.4' }],
      kpis: {
        order_count: 2,
        completed_revenue: 100,
        refund_total: 10,
        unique_visitors: 1,
        product_count: 2,
        new_customers: 1,
        returning_customers: 0,
      },
      previousKpis: {
        order_count: 1,
        completed_revenue: 50,
        refund_total: 0,
        unique_visitors: 1,
      },
      dateBounds: bounds,
    };

    const stats = calculateStatistics(data, bounds);
    expect(stats.totalOrders).toBe(2);
    expect(stats.totalRevenue).toBe(90);
    expect(stats.totalVisitors).toBe(1);
    expect(stats.conversionRate).toBe(200);
    expect(stats.topProducts).toHaveLength(1);
    expect(stats.topProducts[0].name).toBe('A');
    expect(stats.newCustomers).toBe(1);
  });

  it('returns product count when no orders in period', () => {
    const data: DatabaseData = {
      orders: [],
      orderItems: [],
      customers: [],
      products: [null, null, null],
      visits: [],
      kpis: { product_count: 3, order_count: 0, completed_revenue: 0, unique_visitors: 0 },
      dateBounds: bounds,
    };

    const stats = calculateStatistics(data, bounds);
    expect(stats.totalProducts).toBe(3);
    expect(stats.totalOrders).toBe(0);
  });
});
