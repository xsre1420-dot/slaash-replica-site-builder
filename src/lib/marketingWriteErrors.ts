/** Map marketing write RPC errors to merchant-friendly Arabic messages. */

const ERROR_MESSAGES: Record<string, string> = {
  patch_failed: 'فشل حفظ الخصم — تأكد من تحديث قاعدة البيانات (npm run db:deploy)',
  invalid_discount_data: 'بيانات الخصم غير صالحة — تحقق من النسبة والسعر',
  forbidden: 'انتهت الجلسة — سجّل الدخول مجدداً',
  session_expired: 'انتهت الجلسة — سجّل الدخول مجدداً',
  not_found: 'المنتج غير موجود',
  no_allowed_fields: 'لم يتم إرسال حقول صالحة للتحديث',
  lock_contention: 'النظام مشغول — حاول مرة أخرى بعد ثوانٍ',
  duplicate_code: 'كود الكوبون موجود مسبقاً',
  invalid_code: 'يرجى إدخال كود الكوبون',
  invalid_discount: 'قيمة الخصم غير صالحة',
  coupon_create_failed: 'فشل في إضافة الكوبون',
};

export function mapMarketingWriteError(error?: string | null): string {
  if (!error) return 'فشل في حفظ التغييرات';
  const key = error.trim().toLowerCase();
  if (ERROR_MESSAGES[key]) return ERROR_MESSAGES[key];
  if (key.includes('duplicate') || key.includes('unique')) return ERROR_MESSAGES.duplicate_code;
  if (key.includes('jwt') || key.includes('session')) return ERROR_MESSAGES.session_expired;
  return error;
}
