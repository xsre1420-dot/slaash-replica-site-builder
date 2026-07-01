import type { LeadRecord } from '@/types/leads';

/** Lead already has an unredeemed access code waiting for customer login. */
export const leadHasPendingAccessCode = (
  lead: Pick<LeadRecord, 'has_pending_code'>
): boolean => Boolean(lead.has_pending_code);

/**
 * Lead can receive exactly one active access code until the merchant account is linked.
 * Enforced in UI and in admin_generate_access_code (DB unique index + RPC guard).
 */
export const canCreateAccessCodeForLead = (
  lead: Pick<LeadRecord, 'converted_user_id' | 'has_pending_code'>
): boolean => !lead.converted_user_id && !leadHasPendingAccessCode(lead);

export const accessCodeBlockReason = (
  lead: Pick<LeadRecord, 'converted_user_id' | 'has_pending_code'>
): 'converted' | 'pending' | null => {
  if (lead.converted_user_id) return 'converted';
  if (leadHasPendingAccessCode(lead)) return 'pending';
  return null;
};
