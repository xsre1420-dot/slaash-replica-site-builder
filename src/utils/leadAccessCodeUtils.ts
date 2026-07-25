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

/** Active code that customers can still redeem (status + expiry). */
export const getUsableActiveAccessCode = (
  codes: AccessCodeRecord[]
): AccessCodeRecord | null => {
  const active = getRawActiveAccessCode(codes);
  if (!active || !canUseAccessCodeByExpiry(active)) return null;
  return active;
};

export const hasActiveAccessCode = (codes: AccessCodeRecord[]): boolean =>
  getUsableActiveAccessCode(codes) != null;

/** DB row still marked active but no longer usable — blocks new generates until replaced/expired. */
export const hasBlockingActiveAccessCode = (codes: AccessCodeRecord[]): boolean =>
  getRawActiveAccessCode(codes) != null;

/** List row flag says pending but fetched codes show none — stale admin_list_leads state. */
export const hasStalePendingCodeFlag = (
  lead: Pick<LeadRecord, 'has_pending_code'>,
  codes: AccessCodeRecord[],
  options?: AccessCodeEligibilityOptions
): boolean =>
  Boolean(options?.codesFetched && leadHasPendingAccessCode(lead) && !hasActiveAccessCode(codes));

export type AccessCodeEligibilityOptions = {
  /** When true, trust `codes` over the list-row `has_pending_code` flag. */
  codesFetched?: boolean;
};

/**
 * Lead can receive a first access code (pre-activation only).
 */
export const canCreateAccessCodeForLead = (
  lead: Pick<LeadRecord, 'converted_user_id' | 'has_pending_code' | 'status'>,
  codes: AccessCodeRecord[] = [],
  options?: AccessCodeEligibilityOptions
): boolean => {
  if (isConvertedLead(lead)) return false;
  if (hasActiveAccessCode(codes)) return false;
  if (options?.codesFetched) return true;
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
  codes: AccessCodeRecord[] = [],
  options?: AccessCodeEligibilityOptions
): boolean => {
  if (isConvertedLead(lead)) {
    return canIssueNewLoginCodeForConvertedLead(lead, codes);
  }
  if (hasActiveAccessCode(codes)) return true;
  if (leadHasPendingAccessCode(lead)) return true;
  return canCreateAccessCodeForLead(lead, codes, options);
};

export const accessCodeBlockReason = (
  lead: Pick<LeadRecord, 'has_pending_code'>,
  codes: AccessCodeRecord[] = [],
  options?: AccessCodeEligibilityOptions
): 'pending' | null => {
  if (hasActiveAccessCode(codes)) return 'pending';
  if (hasStalePendingCodeFlag(lead, codes, options)) return null;
  if (leadHasPendingAccessCode(lead) && codes.length === 0) return 'pending';
  return null;
};

/** Pick the correct dialog flow for this lead. */
export const resolveAccessCodeDialogMode = (
  lead: LeadRecord,
  codes: AccessCodeRecord[]
): 'create' | 'reissue' | 'manage' | 'deliver' => {
  const usableActive = getUsableActiveAccessCode(codes);
  const rawActive = getRawActiveAccessCode(codes);

  if (usableActive || (isConvertedLead(lead) && rawActive)) {
    return 'manage';
  }
  if (hasStalePendingCodeFlag(lead, codes, { codesFetched: true })) {
    return 'create';
  }
  if (hasBlockingActiveAccessCode(codes)) {
    return 'create';
  }
  if (canReissueAccessCodeForLead(lead, codes)) {
    return 'reissue';
  }
  return 'create';
};
