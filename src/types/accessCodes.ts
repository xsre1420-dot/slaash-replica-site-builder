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
  subscription_end_at: string | null;
  redeemed_at: string | null;
  redeemed_user_id: string | null;
  created_at: string;
};

export const ACCESS_CODE_ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'رمز التفعيل غير صحيح',
  code_expired: 'انتهت صلاحية رمز التفعيل — تواصل مع فريق المبيعات',
  code_revoked: 'تم إلغاء هذا الرمز',
  subscription_expired: 'انتهى اشتراكك — تواصل معنا للتجديد',
  activation_failed: 'تعذر تفعيل الحساب، حاول لاحقاً',
  login_failed: 'تعذر تسجيل الدخول، حاول مرة أخرى',
};

export const formatAccessCodeInput = (value: string): string => {
  const raw = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 11);
  if (raw.length <= 3) return raw;
  if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
};

export const buildAccessCodeWhatsAppMessage = (opts: {
  customerName: string;
  accessCode: string;
  planLabel: string;
  durationMonths: number;
  agreedPrice?: number | null;
  loginUrl: string;
}): string => {
  const priceLine = opts.agreedPrice
    ? `\nالسعر المتفق عليه: ${opts.agreedPrice.toLocaleString('ar-IQ')} د.ع`
    : '';
  return (
    `مرحباً ${opts.customerName} 👋\n\n` +
    `تم الاتفاق على اشتراك *${opts.planLabel}* (${opts.durationMonths} ${opts.durationMonths === 12 ? 'شهر' : 'أشهر'}).${priceLine}\n\n` +
    `🔑 *رمز الدخول للمنصة:*\n${opts.accessCode}\n\n` +
    `ادخل من الرابط:\n${opts.loginUrl}\n\n` +
    `اختر «دخول برمز التفعيل» والصق الرمز.`
  );
};
