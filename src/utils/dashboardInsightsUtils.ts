import { isToday, isYesterday, isThisWeek, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth } from 'date-fns';
import { Order } from '@/types';
import { Product } from '@/types';
import { getProductLifecycleStatus } from '@/lib/productLifecycle';
import { getProductLowStockThreshold } from '@/lib/productUpdateUtils';
import { getAvailableQty } from '@/utils/inventoryUtils';
import { getEffectivePaymentStatus } from '@/utils/orderWorkflowUtils';

export type PeriodMetrics = {
  orders: number;
  revenue: number;
  visits: number;
};

export const EMPTY_PERIOD: PeriodMetrics = { orders: 0, revenue: 0, visits: 0 };

export const isCompletedRevenueOrder = (order: Order): boolean => {
  const payment = getEffectivePaymentStatus(order);
  return order.status === 'completed' && payment !== 'refunded';
};

export const computePeriodMetricsFromOrders = (
  orders: Order[],
  opts: { today?: boolean; yesterday?: boolean; thisWeek?: boolean; previousWeek?: boolean }
): PeriodMetrics => {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 6 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 6 });
  const prevWeekStart = subWeeks(weekStart, 1);
  const prevWeekEnd = subWeeks(weekEnd, 1);

  let orderCount = 0;
  let revenue = 0;

  for (const order of orders) {
    const date = new Date(order.date);
    let inPeriod = false;

    if (opts.today && isToday(date)) inPeriod = true;
    if (opts.yesterday && isYesterday(date)) inPeriod = true;
    if (opts.thisWeek && isThisWeek(date, { weekStartsOn: 6 })) inPeriod = true;
    if (opts.previousWeek && date >= prevWeekStart && date <= prevWeekEnd) inPeriod = true;

    if (!inPeriod) continue;

    if (order.status !== 'cancelled') orderCount += 1;
    if (isCompletedRevenueOrder(order)) revenue += order.total;
  }

  return { orders: orderCount, revenue, visits: 0 };
};

export const parseRpcPeriodMetrics = (data: Record<string, unknown> | null | undefined): PeriodMetrics => {
  if (!data || typeof data !== 'object') return EMPTY_PERIOD;
  return {
    orders: Number(data.order_count ?? 0),
    revenue: Number(data.completed_revenue ?? 0),
    visits: Number(data.visit_count ?? 0),
  };
};

export const formatKpiTrend = (
  current: number,
  previous: number,
  ordersCount?: number
): { trend?: string; trendUp?: boolean } => {
  const orderPart =
    ordersCount != null && ordersCount > 0
      ? `${ordersCount} ${ordersCount === 1 ? 'طلب' : 'طلبات'}`
      : ordersCount === 0
        ? 'لا طلبات'
        : '';

  if (previous === 0 && current === 0) {
    return orderPart ? { trend: orderPart, trendUp: true } : {};
  }

  let changePart = '';
  if (previous === 0 && current > 0) {
    changePart = 'أعلى من أمس';
  } else {
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) changePart = 'مثل الفترة السابقة';
    else changePart = `${pct > 0 ? '+' : ''}${pct}%`;
  }

  const trend = [orderPart, changePart].filter(Boolean).join(' · ');
  const trendUp = previous === 0 ? current >= 0 : current >= previous;

  return trend ? { trend, trendUp } : {};
};

export type InventoryAlertStatus = 'good' | 'low' | 'out';

export const getInventoryAlertStatus = (product: Product): InventoryAlertStatus => {
  const qty = getAvailableQty(product);
  const minLevel = getProductLowStockThreshold(product);
  if (qty === 0) return 'out';
  if (qty <= minLevel) return 'low';
  return 'good';
};

/** Products needing inventory attention (low or out) — matches Inventory page logic */
export const countLowStockProducts = (products: Product[]): number =>
  products.filter((p) => {
    if (getProductLifecycleStatus(p) === 'archived') return false;
    const status = getInventoryAlertStatus(p);
    return status === 'low' || status === 'out';
  }).length;

export const summarizeInventoryAlerts = (
  products: Product[]
): { low: number; out: number; total: number } => {
  let low = 0;
  let out = 0;
  for (const p of products) {
    if (getProductLifecycleStatus(p) === 'archived') continue;
    const status = getInventoryAlertStatus(p);
    if (status === 'low') low += 1;
    if (status === 'out') out += 1;
  }
  return { low, out, total: low + out };
};

export const countDraftProducts = (products: Product[]): number =>
  products.filter((p) => getProductLifecycleStatus(p) === 'draft').length;

export const getWeekBoundsIso = () => {
  const start = startOfWeek(new Date(), { weekStartsOn: 6 });
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const getPreviousWeekBoundsIso = () => {
  const start = startOfWeek(subDays(new Date(), 7), { weekStartsOn: 6 });
  start.setHours(0, 0, 0, 0);
  const end = endOfWeek(subDays(new Date(), 7), { weekStartsOn: 6 });
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const getTodayBoundsIso = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const getYesterdayBoundsIso = () => {
  const start = subDays(new Date(), 1);
  start.setHours(0, 0, 0, 0);
  const end = subDays(new Date(), 1);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const getMonthBoundsIso = () => {
  const start = startOfMonth(new Date());
  start.setHours(0, 0, 0, 0);
  const end = endOfMonth(new Date());
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};
