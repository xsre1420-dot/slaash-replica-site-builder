import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { AccessCodeRecord } from '@/types/accessCodes';

const FAR_FUTURE_YEAR = 2090;

export const isFarFutureExpiry = (iso: string | null | undefined): boolean => {
  if (!iso) return true;
  return new Date(iso).getFullYear() >= FAR_FUTURE_YEAR;
};

export const isDatePast = (iso: string | null | undefined): boolean => {
  if (!iso) return false;
  return new Date(iso) < new Date();
};

/** Effective subscription/code end — prefers subscription_end_at, falls back to code_expires_at. */
export const getAccessCodeEffectiveEnd = (code: Pick<AccessCodeRecord, 'subscription_end_at' | 'code_expires_at'>): Date | null => {
  const raw = code.subscription_end_at ?? code.code_expires_at;
  if (!raw || isFarFutureExpiry(raw)) return null;
  return new Date(raw);
};

export const getRemainingSubscriptionMonths = (endAt: Date | null): number => {
  if (!endAt || endAt <= new Date()) return 0;
  const diffMs = endAt.getTime() - Date.now();
  const months = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30));
  return Math.max(months, 1);
};

export const formatAccessCodeExpiryLabel = (
  code: Pick<AccessCodeRecord, 'subscription_end_at' | 'code_expires_at' | 'status' | 'duration_months'>,
  opts?: { converted?: boolean }
): string | null => {
  const end = getAccessCodeEffectiveEnd(code);
  if (!end) {
    if (code.status === 'active' && !opts?.converted && code.code_expires_at && !isFarFutureExpiry(code.code_expires_at)) {
      return `صلاحية التفعيل حتى ${format(new Date(code.code_expires_at), 'dd MMM yyyy', { locale: ar })}`;
    }
    return null;
  }

  if (isDatePast(end.toISOString())) {
    return 'انتهى الاشتراك';
  }

  const remaining = getRemainingSubscriptionMonths(end);
  const dateLabel = format(end, 'dd MMM yyyy', { locale: ar });
  return opts?.converted
    ? `متبقٍ ${remaining} ${remaining === 1 ? 'شهر' : 'أشهر'} · ينتهي ${dateLabel}`
    : `ينتهي ${dateLabel}`;
};

export const canUseAccessCodeByExpiry = (
  code: Pick<AccessCodeRecord, 'status' | 'subscription_end_at' | 'code_expires_at'>
): boolean => {
  if (code.status !== 'active') return code.status === 'redeemed';
  if (code.code_expires_at && !isFarFutureExpiry(code.code_expires_at) && isDatePast(code.code_expires_at)) {
    return false;
  }
  const end = getAccessCodeEffectiveEnd(code);
  if (end && isDatePast(end.toISOString())) return false;
  return true;
};

export const getSubscriptionEndFromCodes = (codes: AccessCodeRecord[]): string | null => {
  for (const code of codes) {
    const end = code.subscription_end_at ?? (isFarFutureExpiry(code.code_expires_at) ? null : code.code_expires_at);
    if (end && !isDatePast(end)) return end;
  }
  const redeemed = codes.find((c) => c.status === 'redeemed' && c.subscription_end_at);
  return redeemed?.subscription_end_at ?? null;
};
