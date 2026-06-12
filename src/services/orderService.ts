import { supabase } from '@/integrations/supabase/client';
import { Order, CartItem } from '@/types';
import { mapDbOrder } from '@/mappers/orderMapper';
import { clearCheckoutIdempotencyKey, getOrCreateIdempotencyKey } from '@/utils/checkoutSession';
import { mapOrderError } from '@/utils/orderErrors';

export const ORDERS_PER_PAGE = 50;

export const ORDER_DETAIL_SELECT =
  'id, status, total_amount, created_at, customer_name, customer_phone, customer_address, customer_governorate, notes, coupon_code, discount_amount, payment_method, payment_status, delivery_fee, delivery_status, order_items(id, product_id, product_name, product_price, quantity, subtotal, variant_metadata)';

export const ORDER_LIST_SELECT =
  'id, status, total_amount, created_at, updated_at, customer_name, customer_phone, customer_address, customer_governorate, notes, delivery_fee, delivery_status, order_items(id, product_id, product_name, product_price, quantity, subtotal, variant_metadata)';

export const fetchOrderById = async (
  orderId: string,
  ownerId: string
): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .eq('id', orderId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error || !data) return null;
  return mapDbOrder(data as Record<string, unknown>);
};

export const fetchOrdersPage = async (
  ownerId: string,
  page = 0,
  pageSize = ORDERS_PER_PAGE
): Promise<Order[]> => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_SELECT)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error || !data) return [];
  return data.map((row) => mapDbOrder(row as Record<string, unknown>));
};

export const updateOrderStatus = async (
  orderId: string,
  ownerId: string,
  status: Order['status']
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: mapOrderError(error.message) };
  return { success: true };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableOrderError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('lock') ||
    lower.includes('could not be processed') ||
    lower.includes('stock') ||
    lower.includes('connection')
  );
};

export const createOrder = async (
  order: Order,
  ownerId: string,
  paymentMethod = 'cash_on_delivery',
  couponCode?: string | null
): Promise<Order> => {
  const idempotencyKey = getOrCreateIdempotencyKey(ownerId);
  const maxAttempts = 3;

  const orderItems = order.items.map((item: CartItem) => ({
    product_id: item.product.id,
    quantity: item.quantity,
    selected_size: item.selectedSize || null,
    selected_color: item.selectedColor || null,
  }));

  let lastError = 'Order creation failed';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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

    if (!error && data?.success) {
      clearCheckoutIdempotencyKey(ownerId);
      return {
        id: data.order_id,
        ...order,
        total: Number(data.total_amount ?? order.total),
      };
    }

    lastError = mapOrderError(error?.message || data?.error || 'Order creation failed');

    if (attempt < maxAttempts && isRetryableOrderError(lastError)) {
      await sleep(400 * attempt);
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError);
};
