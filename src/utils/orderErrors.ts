import { mapPaymentError } from '@/utils/paymentUtils';

export type OrderRpcErrorPayload = {
  error?: string;
  product_name?: string;
  available?: number;
  requested?: number;
  expected_total?: number;
};

export const mapOrderRpcFailure = (payload: OrderRpcErrorPayload | null | undefined): string => {
  const raw = String(payload?.error || 'Order creation failed');
  const lower = raw.toLowerCase();

  if (
    lower.includes('insufficient stock') &&
    payload?.product_name
  ) {
    const available = payload.available ?? 0;
    const requested = payload.requested ?? 0;
    return `"${payload.product_name}" غير متوفر بالكمية المطلوبة (المتوفر: ${available}، المطلوب: ${requested}). راجع السلة وحدّث الصفحة.`;
  }

  return mapOrderError(raw);
};

export const mapOrderError = (message: string): string => {
  const lower = message.toLowerCase();

  if (lower.includes('rate_limit') || lower.includes('محاولات كثيرة')) {
    return message;
  }

  if (lower.includes('stock_deduction_failed')) {
    return 'تعذر خصم المخزون — ربما نفد أحد المنتجات أثناء الطلب. حدّث الصفحة وراجع السلة.';
  }

  if (lower.includes('insufficient stock')) {
    return 'بعض المنتجات غير متوفرة بالكمية المطلوبة. راجع السلة وحدّث الصفحة.';
  }

  if (
    lower.includes('stock') ||
    lower.includes('مخزون') ||
    lower.includes('insufficient')
  ) {
    return 'بعض المنتجات غير متوفرة بالكمية المطلوبة. راجع السلة وحدّث الصفحة.';
  }

  if (lower.includes('total_amount_mismatch')) {
    return 'تغيّر سعر الطلب (منتجات أو توصيل). يرجى تحديث الصفحة والمحاولة مرة أخرى.';
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

  if (lower.includes('customer_info_required')) {
    return 'يرجى إدخال الاسم ورقم الهاتف والعنوان بشكل صحيح.';
  }

  if (
    lower.includes('unauthorized_checkout') ||
    lower.includes('store_owner_mismatch') ||
    lower.includes('store_slug_required') ||
    lower.includes('store_not_found')
  ) {
    return 'تعذر تحديد المتجر لهذا الطلب. افتح المتجر من الرابط الرسمي وحاول مرة أخرى.';
  }

  if (lower.includes('could not be processed')) {
    return 'تعذر معالجة الطلب. تحقق من المخزون والأسعار وحاول مرة أخرى.';
  }

  if (lower.includes('payment_method')) {
    return mapPaymentError(message);
  }

  return message || 'فشل في إنشاء الطلب. يرجى المحاولة مرة أخرى.';
};
