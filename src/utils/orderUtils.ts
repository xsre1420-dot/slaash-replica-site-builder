import { Order } from '@/types';
import { createOrder, updateOrderStatus as updateOrderStatusInDb } from '@/services/orderService';

export { mapOrderError } from '@/utils/orderErrors';
export { clearCheckoutIdempotencyKey } from '@/utils/checkoutSession';

export const saveOrderToDatabase = (
  order: Order,
  ownerId: string,
  paymentMethod = 'cash_on_delivery',
  couponCode?: string | null,
  storeSlug?: string | null
) => createOrder(order, ownerId, paymentMethod, couponCode, storeSlug);

export const updateOrderStatusInDatabase = async (
  orderId: string,
  status: string,
  ownerId: string
) => {
  if (!ownerId) {
    throw new Error('Owner ID is required to update order status');
  }

  const result = await updateOrderStatusInDb(orderId, ownerId, status as Order['status']);
  if (!result.success) throw new Error(result.error);
};
