import type { LeadRecord } from '@/types/leads';

/** Lead can get a new access code until a merchant account is linked. */
export const canCreateAccessCodeForLead = (lead: Pick<LeadRecord, 'converted_user_id'>): boolean =>
  !lead.converted_user_id;
