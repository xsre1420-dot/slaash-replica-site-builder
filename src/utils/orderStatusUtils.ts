export type OrderStatus = 'pending' | 'completed' | 'cancelled';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const canTransitionOrderStatus = (
  from: OrderStatus,
  to: OrderStatus
): boolean => {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
};

export const getAllowedNextStatuses = (current: OrderStatus): OrderStatus[] =>
  ALLOWED_TRANSITIONS[current] ?? [];
