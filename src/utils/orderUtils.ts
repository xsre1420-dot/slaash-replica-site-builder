
import { supabase } from '@/integrations/supabase/client';
import { Order, CartItem } from '@/types';

const getOrCreateIdempotencyKey = (ownerId: string): string => {
  const storageKey = `checkout-idempotency:${ownerId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(storageKey, key);
  return key;
};

export const clearCheckoutIdempotencyKey = (ownerId: string) => {
  sessionStorage.removeItem(`checkout-idempotency:${ownerId}`);
};

export const saveOrderToDatabase = async (
  order: Order,
  ownerId: string,
  paymentMethod = 'cash_on_delivery',
  couponCode?: string | null
) => {
  const idempotencyKey = getOrCreateIdempotencyKey(ownerId);

  const orderItems = order.items.map((item: CartItem) => ({
    product_id: item.product.id,
    quantity: item.quantity,
    selected_size: item.selectedSize || null,
    selected_color: item.selectedColor || null,
  }));

  const { data, error } = await (supabase as any).rpc('create_order_with_stock_deduction', {
    p_order_id: order.id,
    p_owner_id: ownerId,
    p_idempotency_key: idempotencyKey,
    p_customer_name: order.customerInfo.name,
    p_customer_phone: order.customerInfo.phone,
    p_customer_address: order.customerInfo.address,
    p_total_amount: order.total,
    p_customer_governorate: order.customerInfo.governorate || null,
    p_notes: order.customerInfo.notes || null,
    p_items: orderItems,
    p_payment_method: paymentMethod,
    p_coupon_code: couponCode || null,
  });

  if (error) {
    throw new Error(error.message || 'Failed to create order');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Order creation failed');
  }

  clearCheckoutIdempotencyKey(ownerId);

  return {
    id: data.order_id,
    ...order,
    total: Number(data.total_amount ?? order.total),
  };
};

export const updateOrderStatusInDatabase = async (orderId: string, status: string, ownerId: string) => {
  if (!ownerId) {
    throw new Error('Owner ID is required to update order status');
  }

  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('owner_id', ownerId);

  if (error) throw error;
};
