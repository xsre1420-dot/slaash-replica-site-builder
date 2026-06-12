import { mapPaymentError } from '@/utils/paymentUtils';

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
  if (lower.includes('payment_method')) {
    return mapPaymentError(message);
  }
  return message || 'فشل في إنشاء الطلب. يرجى المحاولة مرة أخرى.';
};
