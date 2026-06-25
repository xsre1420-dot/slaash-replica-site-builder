import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import type { OrderDatePreset, OrderListFilters } from '@/utils/orderWorkflowUtils';

export type OrderDateRange = {
  from: string | null;
  to: string | null;
};

export const getDateRangeForPreset = (preset: OrderDatePreset): OrderDateRange => {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
    }
    case 'week':
      return {
        from: startOfWeek(now, { weekStartsOn: 6 }).toISOString(),
        to: endOfWeek(now, { weekStartsOn: 6 }).toISOString(),
      };
    case 'month':
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    default:
      return { from: null, to: null };
  }
};

/** Stable cache/query key fragment for filter state. */
export const serializeOrderFilters = (filters: OrderListFilters): string =>
  JSON.stringify({
    s: filters.search.trim(),
    w: filters.workflowTab,
    os: filters.orderStatus,
    ps: filters.paymentStatus,
    ds: filters.deliveryStatus,
    d: filters.datePreset,
    min: filters.minValue ?? null,
    max: filters.maxValue ?? null,
  });

export const filtersToRpcParams = (
  filters: OrderListFilters,
  page: number,
  pageSize: number,
  cursor?: string | null
) => {
  const range = getDateRangeForPreset(filters.datePreset);
  return {
    p_page: page,
    p_page_size: pageSize,
    p_search: filters.search.trim() || null,
    p_workflow_tab: filters.workflowTab,
    p_order_status: filters.orderStatus,
    p_payment_status: filters.paymentStatus,
    p_delivery_status: filters.deliveryStatus,
    p_date_from: range.from,
    p_date_to: range.to,
    p_min_value: filters.minValue ?? null,
    p_max_value: filters.maxValue ?? null,
    p_cursor: cursor?.trim() || null,
  };
};

export const filtersToRpcParamsWithoutWorkflow = (filters: OrderListFilters) => {
  const range = getDateRangeForPreset(filters.datePreset);
  return {
    p_search: filters.search.trim() || null,
    p_order_status: filters.orderStatus,
    p_payment_status: filters.paymentStatus,
    p_delivery_status: filters.deliveryStatus,
    p_date_from: range.from,
    p_date_to: range.to,
    p_min_value: filters.minValue ?? null,
    p_max_value: filters.maxValue ?? null,
  };
};
