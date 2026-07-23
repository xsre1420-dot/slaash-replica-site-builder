import { Order } from '@/types';
import { getDeliveryStatusLabel, DeliveryStatus } from '@/utils/deliveryUtils';
import { getPaymentStatusLabel, PaymentStatus } from '@/utils/paymentUtils';
import { isToday, isYesterday, isThisWeek, isThisMonth, format } from 'date-fns';

export type OrderWorkflowCategory = 'new' | 'completed' | 'cancelled';
export type OrderWorkflowTab = OrderWorkflowCategory | 'all';

export type OrderDatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month';

export interface OrderListFilters {
  search: string;
  workflowTab: OrderWorkflowTab;
  orderStatus: 'all' | Order['status'];
  paymentStatus: 'all' | PaymentStatus | string;
  deliveryStatus: 'all' | DeliveryStatus | string;
  datePreset: OrderDatePreset;
  minValue?: number;
  maxValue?: number;
}

export const DEFAULT_ORDER_FILTERS: OrderListFilters = {
  search: '',
  workflowTab: 'all',
  orderStatus: 'all',
  paymentStatus: 'all',
  deliveryStatus: 'all',
  datePreset: 'all',
};

export const WORKFLOW_TABS: { id: OrderWorkflowTab; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'new', label: 'جديد' },
  { id: 'completed', label: 'مكتمل' },
  { id: 'cancelled', label: 'ملغي' },
];

/** Maps legacy RPC workflow keys to the simplified 3-tab model. */
export const normalizeWorkflowTabCounts = (
  raw: Partial<Record<string, number>> | null | undefined
): Record<OrderWorkflowCategory, number> => {
  if (!raw) {
    return { new: 0, completed: 0, cancelled: 0 };
  }

  if ('completed' in raw && !('delivered' in raw) && !('processing' in raw)) {
    return {
      new: raw.new ?? 0,
      completed: raw.completed ?? 0,
      cancelled: raw.cancelled ?? 0,
    };
  }

  return {
    new: (raw.new ?? 0) + (raw.processing ?? 0) + (raw.paid ?? 0) + (raw.shipped ?? 0),
    completed: raw.completed ?? raw.delivered ?? 0,
    cancelled: (raw.cancelled ?? 0) + (raw.refunded ?? 0),
  };
};

export const formatOrderNumber = (orderId: string): string =>
  `#${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

export const formatOrderDateTime = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return format(date, 'yyyy-MM-dd · hh:mm a');
  } catch {
    return value;
  }
};

export const normalizeOrderPhone = (phone: string): string =>
  phone.replace(/\D/g, '');

export const getEffectivePaymentStatus = (order: Order): string =>
  order.paymentStatus || 'pending_collection';

export const getEffectiveDeliveryStatus = (order: Order): string =>
  order.deliveryStatus || 'pending';

export const getOrderWorkflowCategory = (order: Order): OrderWorkflowCategory => {
  if (order.status === 'cancelled') return 'cancelled';

  const paymentStatus = getEffectivePaymentStatus(order);
  if (paymentStatus === 'refunded' || paymentStatus === 'partially_refunded') {
    return 'cancelled';
  }

  if (order.status === 'completed') return 'completed';

  return 'new';
};

export const matchesWorkflowTab = (order: Order, tab: OrderWorkflowTab): boolean =>
  tab === 'all' || getOrderWorkflowCategory(order) === tab;

const matchesDatePreset = (orderDate: string, preset: OrderDatePreset): boolean => {
  if (preset === 'all') return true;
  const date = new Date(orderDate);
  switch (preset) {
    case 'today':
      return isToday(date);
    case 'yesterday':
      return isYesterday(date);
    case 'week':
      return isThisWeek(date, { weekStartsOn: 6 });
    case 'month':
      return isThisMonth(date);
    default:
      return true;
  }
};

export const filterOrdersList = (
  orders: Order[],
  filters: OrderListFilters,
  options?: { skipWorkflow?: boolean }
): Order[] => {
  const q = filters.search.trim().toLowerCase();
  const qDigits = normalizeOrderPhone(filters.search);

  return orders.filter((order) => {
    if (q) {
      const matchesSearch =
        order.customerInfo.name.toLowerCase().includes(q) ||
        order.customerInfo.phone.includes(q) ||
        (qDigits.length >= 4 && normalizeOrderPhone(order.customerInfo.phone).includes(qDigits)) ||
        order.id.toLowerCase().includes(q) ||
        formatOrderNumber(order.id).toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    if (!options?.skipWorkflow && !matchesWorkflowTab(order, filters.workflowTab)) return false;

    if (filters.orderStatus !== 'all' && order.status !== filters.orderStatus) return false;

    if (
      filters.paymentStatus !== 'all' &&
      getEffectivePaymentStatus(order) !== filters.paymentStatus
    ) {
      return false;
    }

    if (
      filters.deliveryStatus !== 'all' &&
      getEffectiveDeliveryStatus(order) !== filters.deliveryStatus
    ) {
      return false;
    }

    if (!matchesDatePreset(order.date, filters.datePreset)) return false;

    if (filters.minValue != null && order.total < filters.minValue) return false;
    if (filters.maxValue != null && order.total > filters.maxValue) return false;

    return true;
  });
};

export const countOrdersByWorkflowTab = (orders: Order[]): Record<OrderWorkflowCategory, number> => {
  const counts: Record<OrderWorkflowCategory, number> = {
    new: 0,
    completed: 0,
    cancelled: 0,
  };

  orders.forEach((order) => {
    const category = getOrderWorkflowCategory(order);
    counts[category] += 1;
  });

  return counts;
};

export const getOrderStatusLabel = (status: Order['status']): string => {
  switch (status) {
    case 'pending':
      return 'جديد';
    case 'completed':
      return 'مكتمل';
    case 'cancelled':
      return 'ملغي';
    default:
      return status;
  }
};

export const getWorkflowTabLabel = (tab: OrderWorkflowTab): string =>
  WORKFLOW_TABS.find((t) => t.id === tab)?.label ?? tab;

export type SimplifiedOrderStatusKey = OrderWorkflowCategory;

/** Single merchant-facing status for list cards (one badge instead of order/payment/delivery). */
export const getSimplifiedOrderDisplayStatus = (
  order: Order
): { label: string; key: SimplifiedOrderStatusKey } => {
  const workflow = getOrderWorkflowCategory(order);

  switch (workflow) {
    case 'new':
      return { label: 'جديد', key: 'new' };
    case 'completed':
      return { label: 'مكتمل', key: 'completed' };
    case 'cancelled':
      return { label: 'ملغي', key: 'cancelled' };
    default:
      return { label: 'جديد', key: 'new' };
  }
};

export const buildOrderTimelineEvents = (
  order: Order,
  shipmentEvents: { status: string; note?: string; created_at: string }[] = []
) => {
  const events: { id: string; title: string; detail?: string; at: string; kind: 'order' | 'payment' | 'delivery' }[] = [
    {
      id: 'created',
      title: 'تم إنشاء الطلب',
      detail: `${order.items.length} منتج · ${order.total.toLocaleString()} د.ع`,
      at: order.date,
      kind: 'order',
    },
  ];

  if (order.paymentStatus) {
    events.push({
      id: 'payment',
      title: getPaymentStatusLabel(order.paymentStatus),
      detail: order.paymentMethod ? undefined : undefined,
      at: order.date,
      kind: 'payment',
    });
  }

  shipmentEvents.forEach((ev, i) => {
    events.push({
      id: `ship-${i}-${ev.created_at}`,
      title: getDeliveryStatusLabel(ev.status),
      detail: ev.note,
      at: ev.created_at,
      kind: 'delivery',
    });
  });

  if (order.status === 'completed') {
    events.push({
      id: 'completed',
      title: 'اكتمل الطلب',
      at: order.date,
      kind: 'order',
    });
  }

  if (order.status === 'cancelled') {
    events.push({
      id: 'cancelled',
      title: 'تم إلغاء الطلب',
      at: order.date,
      kind: 'order',
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
};

export const computeOrderStats = (orders: Order[]) => {
  const workflowCounts = countOrdersByWorkflowTab(orders);
  const completedOrders = orders.filter((o) => getOrderWorkflowCategory(o) === 'completed');

  const revenue = completedOrders.reduce((sum, o) => sum + o.total, 0);

  const revenueInPeriod = (predicate: (date: Date) => boolean) =>
    completedOrders
      .filter((o) => predicate(new Date(o.date)))
      .reduce((sum, o) => sum + o.total, 0);

  const pendingRevenue = orders
    .filter((o) => getOrderWorkflowCategory(o) === 'new')
    .reduce((sum, o) => sum + o.total, 0);

  const todayOrders = orders.filter((o) => isToday(new Date(o.date))).length;
  const weekOrders = orders.filter((o) => isThisWeek(new Date(o.date), { weekStartsOn: 6 })).length;
  const monthOrders = orders.filter((o) => isThisMonth(new Date(o.date))).length;

  return {
    total: orders.length,
    newOrders: workflowCounts.new,
    pendingFulfillment: workflowCounts.new,
    delivered: workflowCounts.completed,
    revenue,
    todayRevenue: revenueInPeriod((d) => isToday(d)),
    weekRevenue: revenueInPeriod((d) => isThisWeek(d, { weekStartsOn: 6 })),
    monthRevenue: revenueInPeriod((d) => isThisMonth(d)),
    pendingRevenue,
    avgOrderValue: completedOrders.length > 0 ? Math.round(revenue / completedOrders.length) : 0,
    todayOrders,
    weekOrders,
    monthOrders,
  };
};

/** Fulfillment pipeline steps shown in order details and list. */
export type FulfillmentStepId =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'delivered';

export const FULFILLMENT_STEPS: { id: FulfillmentStepId; label: string }[] = [
  { id: 'new', label: 'جديد' },
  { id: 'confirmed', label: 'مؤكد' },
  { id: 'preparing', label: 'تجهيز' },
  { id: 'ready', label: 'جاهز للشحن' },
  { id: 'shipped', label: 'مشحون' },
  { id: 'delivered', label: 'مُسلّم' },
];

export const getOrderFulfillmentStep = (order: Order): FulfillmentStepId => {
  if (order.status === 'cancelled') return 'new';
  const delivery = getEffectiveDeliveryStatus(order);
  const payment = getEffectivePaymentStatus(order);

  if (delivery === 'delivered' || order.status === 'completed') return 'delivered';
  if (delivery === 'shipped' || delivery === 'out_for_delivery') return 'shipped';
  if (delivery === 'preparing') return 'preparing';
  if (payment === 'paid' || payment === 'collected') return 'confirmed';
  if (order.status === 'pending') return 'new';
  return 'new';
};

export const getFulfillmentStepIndex = (step: FulfillmentStepId): number =>
  FULFILLMENT_STEPS.findIndex((s) => s.id === step);

export const computeCustomerInsights = (
  orders: Order[],
  phone: string
): { orderCount: number; totalSpent: number; lastOrderDate?: string } => {
  const digits = normalizeOrderPhone(phone);
  if (!digits) return { orderCount: 0, totalSpent: 0 };

  const matched = orders.filter(
    (o) => normalizeOrderPhone(o.customerInfo.phone) === digits && o.status !== 'cancelled'
  );

  return {
    orderCount: matched.length,
    totalSpent: matched.reduce((sum, o) => sum + o.total, 0),
    lastOrderDate: matched[0]?.date,
  };
};

export { getPaymentStatusLabel, getDeliveryStatusLabel };
