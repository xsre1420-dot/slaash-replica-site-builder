import { describe, it, expect } from 'vitest';
import { netRevenueFromRpc } from './analyticsMetrics';
import { parseRpcPeriodMetrics } from './dashboardInsightsUtils';

describe('analyticsMetrics', () => {
  it('returns net revenue as completed_revenue minus refund_total', () => {
    expect(netRevenueFromRpc({ completed_revenue: 500, refund_total: 50 })).toBe(450);
  });

  it('never returns negative net revenue', () => {
    expect(netRevenueFromRpc({ completed_revenue: 10, refund_total: 100 })).toBe(0);
  });

  it('treats missing refunds as zero', () => {
    expect(netRevenueFromRpc({ completed_revenue: 200 })).toBe(200);
  });

  it('returns zero for null or invalid input', () => {
    expect(netRevenueFromRpc(null)).toBe(0);
    expect(netRevenueFromRpc({ completed_revenue: 'bad' })).toBe(0);
  });
});

describe('parseRpcPeriodMetrics', () => {
  it('maps RPC payload to net revenue and visit count', () => {
    const metrics = parseRpcPeriodMetrics({
      order_count: 12,
      completed_revenue: 1000,
      refund_total: 75,
      visit_count: 340,
    });
    expect(metrics).toEqual({ orders: 12, revenue: 925, visits: 340 });
  });
});
