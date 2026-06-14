import { Order } from '@/types';
import { getDeliveryStatusLabel, DeliveryStatus } from '@/utils/deliveryUtils';
import { getPaymentStatusLabel, PaymentStatus } from '@/utils/paymentUtils';
import { isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';

export type OrderWorkflowTab =
  | 'all'
  | 'new'
  | 'processing'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

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
  { id: 'new', label: 'جديدة' },
  { id: 'processing', label: 'قيد المعالجة' },
  { id: 'paid', label: 'مدفوعة' },
  { id: 'shipped', label: 'مشحونة' },
  { id: 'delivered', label: 'مُسلّمة' },
  { id: 'cancelled', label: 'ملغاة' },
  { id: 'refunded', label: 'مستردة' },
];

export const formatOrderNumber = (orderId: string): string =>
  `#${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

export const normalizeOrderPhone = (phone: string): string =>
  phone.replace(/\D/g, '');

export const getEffectivePaymentStatus = (order: Order): string =>
  order.paymentStatus || 'pending_collection';

export const getEffectiveDeliveryStatus = (order: Order): string =>
  order.deliveryStatus || 'pending';

export const getOrderWorkflowCategory = (order: Order): OrderWorkflowTab => {
  const paymentStatus = getEffectivePaymentStatus(order);
  const deliveryStatus = getEffectiveDeliveryStatus(order);

  if (order.status === 'cancelled') return 'cancelled';
  if (paymentStatus === 'refunded' || paymentStatus === 'partially_refunded') {
    return 'refunded';
  }
  if (deliveryStatus === 'delivered' || order.status === 'completed') return 'delivered';
  if (deliveryStatus === 'shipped' || deliveryStatus === 'out_for_delivery') {
    return 'shipped';
  }
  if (paymentStatus === 'paid' || paymentStatus === 'collected') return 'paid';
  if (deliveryStatus === 'preparing') return 'processing';
  if (order.status === 'pending') return 'new';
  return 'new';
};

export const matchesWorkflowTab = (order: Order, tab: OrderWorkflowTab): boolean => {
  if (tab === 'all') return true;
  return getOrderWorkflowCategory(order) === tab;
};

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

export const filterOrdersList = (orders: Order[], filters: OrderListFilters): Order[] => {
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

    if (!matchesWorkflowTab(order, filters.workflowTab)) return false;

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

export const countOrdersByWorkflowTab = (orders: Order[]): Record<OrderWorkflowTab, number> => {
  const counts: Record<OrderWorkflowTab, number> = {
    all: orders.length,
    new: 0,
    processing: 0,
    paid: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
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
      return 'قيد الانتظار';
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
  const revenue = orders
    .filter((o) => {
      const payment = getEffectivePaymentStatus(o);
      return o.status === 'completed' && payment !== 'refunded';
    })
    .reduce((sum, o) => sum + o.total, 0);

  return {
    total: orders.length,
    newOrders: workflowCounts.new,
    pendingFulfillment: workflowCounts.new + workflowCounts.processing + workflowCounts.paid,
    delivered: workflowCounts.delivered,
    revenue,
  };
};

export { getPaymentStatusLabel, getDeliveryStatusLabel };
