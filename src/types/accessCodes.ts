export type AccessCodeStatus = 'active' | 'redeemed' | 'expired' | 'revoked';

export type AccessCodeRecord = {
  id: string;
  lead_id: string;
  code_hint: string;
  plan_id: string;
  duration_months: number;
  agreed_price: number | null;
  store_name: string | null;
  username: string | null;
  status: AccessCodeStatus;
  code_expires_at: string;
  subscription_start_at?: string | null;
  subscription_end_at: string | null;
  redeemed_at: string | null;
  redeemed_user_id: string | null;
  created_at: string;
};

export const ACCESS_CODE_ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'رمز التفعيل غير صحيح',
  code_expired: 'انتهت صلاحية الرمز — اطلب رمزاً جديداً من فريق المبيعات',
  code_revoked: 'تم إلغاء هذا الرمز',
  active_code_exists: 'يوجد رمز قديم — سيتم استبداله تلقائياً عند إنشاء رمز جديد للعميل المُفعّل',
  no_active_code: 'لا يوجد رمز نشط لإلغائه',
  revoke_failed: 'تعذر إلغاء الرمز',
  subscription_expired: 'انتهى اشتراكك — تواصل معنا للتجديد',
  activation_failed: 'تعذر تفعيل الحساب، حاول لاحقاً',
  create_user_failed: 'تعذر إنشاء حساب التاجر — تواصل مع فريق المبيعات',
  subscription_failed: 'تعذر تفعيل الاشتراك — تواصل مع فريق المبيعات',
  provision_failed: 'تعذر تهيئة المتجر — حاول مرة أخرى أو تواصل مع الدعم',
  lead_already_converted: 'هذا العميل مُفعّل — استخدم «إنشاء رمز جديد للعميل»',
  forbidden: 'ليس لديك صلاحية — أضف حسابك كمسؤول',
  login_failed: 'تعذر تسجيل الدخول، حاول مرة أخرى',
  redeem_failed: 'تعذر تفعيل الرمز — تحقق من الرمز أو تواصل مع المبيعات',
  rate_limited: 'محاولات كثيرة — انتظر قليلاً ثم حاول مرة أخرى',
  edge_unavailable:
    'خدمة تفعيل الرمز غير متوفرة حالياً — تأكد من نشر redeem-access-code على Supabase',
  cors_blocked:
    'تعذر الاتصال بخدمة التفعيل من هذا العنوان — أضف localhost إلى ALLOWED_ORIGINS في Supabase',
  network_error: 'تعذر الاتصال بالخادم — تحقق من الإنترنت',
  invalid_plan: 'الباقة غير متوفرة — شغّل npm run db:deploy',
  lead_not_found: 'الطلب غير موجود',
  generate_failed: 'تعذر إنشاء الرمز',
  replace_failed: 'تعذر استبدال الرمز',
  db_migration_required: 'قاعدة البيانات تحتاج تحديث — شغّل: npm run db:deploy',
};

/** Customer-facing login errors — hide admin/dev instructions. */
export const ACCESS_CODE_LOGIN_ERROR_MESSAGES: Record<string, string> = {
  ...ACCESS_CODE_ERROR_MESSAGES,
  db_migration_required:
    'خدمة تفعيل الرمز غير جاهزة على الخادم — تواصل مع فريق المبيعات أو حاول لاحقاً',
  edge_unavailable:
    'خدمة تفعيل الرمز غير متوفرة حالياً — تواصل مع فريق المبيعات أو حاول لاحقاً',
  cors_blocked: 'تعذر الاتصال بخدمة التفعيل — تواصل مع فريق المبيعات',
};

export type AccessCodePreview = {
  planId: string;
  durationMonths: number;
  agreedPrice: number | null;
  storeName: string | null;
};

export type AccessCodeVerifyResult = {
  codeId: string;
  codeHint: string;
  planId: string;
  planLabel: string;
  durationMonths: number;
  agreedPrice: number | null;
  storeName: string | null;
  createdAt: string;
};

/** Body charset matches DB: ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (no I/O/0/1). */
const ACCESS_CODE_COMPACT_PATTERN = /BDY[A-HJ-NP-Z2-9]{8}/;

/** Strip bidi marks and non-alphanumeric noise from pasted text (WhatsApp, RTL, etc.). */
export const normalizeAccessCodeRaw = (value: string): string =>
  value
    .replace(/[\u200B-\u200D\uFEFF\u2066-\u2069]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

/** Extract canonical 11-char compact code (BDY + 8) from messy paste input. */
export const extractAccessCodeCompact = (value: string): string | null => {
  const compact = normalizeAccessCodeRaw(value);
  const match = compact.match(ACCESS_CODE_COMPACT_PATTERN);
  if (match) return match[0];
  if (compact.startsWith('BDY') && compact.length >= 11) {
    return compact.slice(0, 11);
  }
  return null;
};

export const isCompleteAccessCode = (value: string): boolean =>
  extractAccessCodeCompact(value) !== null;

/** Canonical formatted code for API + clipboard (BDY-XXXX-XXXX). */
export const formatAccessCodeForSubmit = (value: string): string | null => {
  const compact = extractAccessCodeCompact(value);
  if (!compact || compact.length !== 11) return null;
  return `${compact.slice(0, 3)}-${compact.slice(3, 7)}-${compact.slice(7, 11)}`;
};

export const formatAccessCodeInput = (value: string): string => {
  const compact = extractAccessCodeCompact(value) ?? normalizeAccessCodeRaw(value).slice(0, 11);
  if (compact.length <= 3) return compact;
  if (compact.length <= 7) return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  return `${compact.slice(0, 3)}-${compact.slice(3, 7)}-${compact.slice(7, 11)}`;
};

export const parseAccessCodePaste = (value: string): string => {
  const formatted = formatAccessCodeForSubmit(value);
  return formatted ?? formatAccessCodeInput(value);
};

export const buildAccessCodeWhatsAppMessage = (opts: {
  customerName: string;
  accessCode: string;
  planLabel: string;
  durationMonths: number;
  agreedPrice?: number | null;
  loginUrl: string;
  /** When set, this is a login-only reissue — subscription is NOT extended. */
  subscriptionEndAt?: string | null;
  isLoginReissue?: boolean;
}): string => {
  const priceLine = opts.agreedPrice
    ? `\nالسعر المتفق عليه: ${opts.agreedPrice.toLocaleString('ar-IQ')} د.ع`
    : '';

  if (opts.isLoginReissue && opts.subscriptionEndAt) {
    const endDate = new Date(opts.subscriptionEndAt).toLocaleDateString('ar-IQ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return (
      `مرحباً ${opts.customerName} 👋\n\n` +
      `🔑 *رمز دخول جديد لحسابك:*\n\u2066${opts.accessCode}\u2069\n\n` +
      `اشتراك *${opts.planLabel}* ينتهي في *${endDate}* (متبقٍ ${opts.durationMonths} ${opts.durationMonths === 1 ? 'شهر' : 'أشهر'}).\n` +
      `⚠️ هذا الرمز للدخول فقط — *لا يمدّد* مدة الاشتراك.${priceLine}\n\n` +
      `ادخل من الرابط:\n${opts.loginUrl}\n\n` +
      `الصق الرمز في صفحة تسجيل الدخول واضغط «دخول للمنصة».`
    );
  }

  return (
    `مرحباً ${opts.customerName} 👋\n\n` +
    `تم الاتفاق على اشتراك *${opts.planLabel}* (${opts.durationMonths} ${opts.durationMonths === 12 ? 'شهر' : opts.durationMonths === 1 ? 'شهر' : 'أشهر'}).${priceLine}\n\n` +
    `🔑 *رمز الدخول للمنصة:*\n\u2066${opts.accessCode}\u2069\n\n` +
    `ادخل من الرابط:\n${opts.loginUrl}\n\n` +
    `الصق الرمز في صفحة تسجيل الدخول واضغط «دخول للمنصة».`
  );
};
