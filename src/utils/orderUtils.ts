
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
  sessionStorage.removeItem(`checkout-fingerprint:${ownerId}`);
};

export const mapOrderError = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes('stock') || lower.includes('مخزون') || lower.includes('insufficient')) {
    return 'بعض المنتجات غير متوفرة بالكمية المطلوبة. يرجى مراجعة السلة.';
  }
  if (lower.includes('total') || lower.includes('amount') || lower.includes('mismatch')) {
    return 'تغيّر سعر الطلب. يرجى مراجعة السلة والمحاولة مرة أخرى.';
  }
  if (lower.includes('coupon') || lower.includes('خصم')) {
    return 'كود الخصم غير صالح أو لم يعد ينطبق على هذا الطلب.';
  }
  if (lower.includes('invalid_status') || lower.includes('status_transition')) {
    return 'لا يمكن تغيير حالة الطلب بهذه الطريقة.';
  }
  if (lower.includes('could not be processed')) {
    return 'تعذر معالجة الطلب. تحقق من المخزون والأسعار وحاول مرة أخرى.';
  }
  return message || 'فشل في إنشاء الطلب. يرجى المحاولة مرة أخرى.';
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

export const saveOrderToDatabase = async (
  order: Order,
  ownerId: string,
  paymentMethod = 'cash_on_delivery',
  couponCode?: string | null
) => {
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
