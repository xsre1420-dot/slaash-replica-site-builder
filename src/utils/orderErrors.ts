import { mapPaymentError } from '@/utils/paymentUtils';

export const mapOrderError = (message: string): string => {
  const lower = message.toLowerCase();

  if (
    lower.includes('stock_deduction_failed') ||
    lower.includes('insufficient stock') ||
    lower.includes('stock') ||
    lower.includes('مخزون') ||
    lower.includes('insufficient')
  ) {
    return 'بعض المنتجات غير متوفرة بالكمية المطلوبة. يرجى مراجعة السلة وتحديث الصفحة.';
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
