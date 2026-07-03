import type { AccessCodeRecord } from '@/types/accessCodes';
import type { LeadRecord } from '@/types/leads';
import {
  canUseAccessCodeByExpiry,
  getSubscriptionEndFromCodes,
  isDatePast,
} from '@/utils/accessCodeExpiryUtils';

/** Lead already has an unredeemed access code waiting for customer login. */
export const leadHasPendingAccessCode = (
  lead: Pick<LeadRecord, 'has_pending_code'>
): boolean => Boolean(lead.has_pending_code);

export const getLastRedeemedAccessCode = (
  codes: AccessCodeRecord[]
): AccessCodeRecord | null => {
  const redeemed = codes.filter((c) => c.status === 'redeemed');
  if (redeemed.length === 0) return null;
  return [...redeemed].sort(
    (a, b) =>
      new Date(b.redeemed_at ?? b.created_at).getTime() -
      new Date(a.redeemed_at ?? a.created_at).getTime()
  )[0];
};

export const isConvertedLead = (
  lead: Pick<LeadRecord, 'converted_user_id' | 'status'>
): boolean => Boolean(lead.converted_user_id) || lead.status === 'customer';

export const getRawActiveAccessCode = (
  codes: AccessCodeRecord[]
): AccessCodeRecord | null => codes.find((c) => c.status === 'active') ?? null;

export const hasActiveAccessCode = (codes: AccessCodeRecord[]): boolean => {
  const active = getRawActiveAccessCode(codes);
  return active != null && canUseAccessCodeByExpiry(active);
};

/**
 * Lead can receive a first access code (pre-activation only).
 */
export const canCreateAccessCodeForLead = (
  lead: Pick<LeadRecord, 'converted_user_id' | 'has_pending_code' | 'status'>,
  codes: AccessCodeRecord[] = []
): boolean => {
  if (isConvertedLead(lead)) return false;
  if (hasActiveAccessCode(codes)) return false;
  return !leadHasPendingAccessCode(lead);
};

/**
 * Active customer: issue a login-only code tied to the original subscription end.
 */
export const canReissueAccessCodeForLead = (
  lead: Pick<LeadRecord, 'converted_user_id' | 'status'>,
  codes: AccessCodeRecord[] = []
): boolean => {
  if (!isConvertedLead(lead)) return false;
  if (getRawActiveAccessCode(codes)) return false;

  const subEnd = getSubscriptionEndFromCodes(codes);
  if (subEnd && isDatePast(subEnd)) return false;

  return true;
};

/** Converted customer with an active subscription can always get a new login code. */
export const canIssueNewLoginCodeForConvertedLead = (
  lead: Pick<LeadRecord, 'converted_user_id' | 'status'>,
  codes: AccessCodeRecord[] = []
): boolean => {
  if (!isConvertedLead(lead)) return false;
  const subEnd = getSubscriptionEndFromCodes(codes);
  if (subEnd && isDatePast(subEnd)) return false;
  return true;
};

export const canManageAccessCodeForLead = (
  lead: Pick<LeadRecord, 'converted_user_id' | 'has_pending_code' | 'status'>,
  codes: AccessCodeRecord[] = []
): boolean => {
  if (isConvertedLead(lead)) {
    return canIssueNewLoginCodeForConvertedLead(lead, codes);
  }
  return hasActiveAccessCode(codes) || canCreateAccessCodeForLead(lead, codes);
};

export const accessCodeBlockReason = (
  lead: Pick<LeadRecord, 'has_pending_code'>,
  codes: AccessCodeRecord[] = []
): 'pending' | null => {
  if (hasActiveAccessCode(codes)) return 'pending';
  if (leadHasPendingAccessCode(lead) && codes.length === 0) return 'pending';
  return null;
};

/** Pick the correct dialog flow for this lead. */
export const resolveAccessCodeDialogMode = (
  lead: LeadRecord,
  codes: AccessCodeRecord[]
): 'create' | 'reissue' | 'manage' | 'deliver' => {
  const rawActive = getRawActiveAccessCode(codes);
  const usableActive =
    rawActive && canUseAccessCodeByExpiry(rawActive) ? rawActive : null;

  if (usableActive || (isConvertedLead(lead) && rawActive)) {
    return 'manage';
  }
  if (canReissueAccessCodeForLead(lead, codes)) {
    return 'reissue';
  }
  return 'create';
};
