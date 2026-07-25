import { describe, it, expect } from 'vitest';
import {
  canCreateAccessCodeForLead,
  canManageAccessCodeForLead,
  canReissueAccessCodeForLead,
  accessCodeBlockReason,
  getLastRedeemedAccessCode,
  hasStalePendingCodeFlag,
  resolveAccessCodeDialogMode,
} from '@/utils/leadAccessCodeUtils';
import type { AccessCodeRecord } from '@/types/accessCodes';

describe('leadAccessCodeUtils', () => {
  it('allows first code when lead is not converted and has no pending code', () => {
    expect(canCreateAccessCodeForLead({ converted_user_id: null, has_pending_code: false })).toBe(true);
    expect(accessCodeBlockReason({ converted_user_id: null, has_pending_code: false })).toBeNull();
  });

  it('blocks first code when lead already has pending code', () => {
    expect(
      canCreateAccessCodeForLead({ converted_user_id: null, has_pending_code: true, status: 'new' })
    ).toBe(false);
    expect(accessCodeBlockReason({ has_pending_code: true }, [])).toBe('pending');
  });

  it('allows create when pending flag is stale and codes were fetched', () => {
    const lead = { converted_user_id: null, has_pending_code: true, status: 'interested' as const };
    expect(canCreateAccessCodeForLead(lead, [], { codesFetched: true })).toBe(true);
    expect(hasStalePendingCodeFlag(lead, [], { codesFetched: true })).toBe(true);
    expect(accessCodeBlockReason(lead, [], { codesFetched: true })).toBeNull();
    expect(canManageAccessCodeForLead(lead, [])).toBe(true);
    expect(resolveAccessCodeDialogMode(lead as import('@/types/leads').LeadRecord, [])).toBe('create');
  });

  it('allows reissue for converted leads without active code', () => {
    const lead = { converted_user_id: 'user-1', has_pending_code: false, status: 'customer' as const };
    const codes: AccessCodeRecord[] = [
      {
        id: '1',
        lead_id: 'lead-1',
        code_hint: 'ABCD',
        plan_id: 'annual',
        duration_months: 6,
        agreed_price: 125000,
        store_name: 'Store',
        username: 'store123',
        status: 'redeemed',
        code_expires_at: '',
        subscription_end_at: null,
        redeemed_at: '2026-01-01',
        redeemed_user_id: 'user-1',
        created_at: '2026-01-01',
      },
    ];
    expect(canCreateAccessCodeForLead(lead, codes)).toBe(false);
    expect(canReissueAccessCodeForLead(lead, codes)).toBe(true);
    expect(canManageAccessCodeForLead(lead, codes)).toBe(true);
    expect(accessCodeBlockReason(lead, codes)).toBeNull();
  });

  it('picks latest redeemed code as template', () => {
    const codes: AccessCodeRecord[] = [
      {
        id: '1',
        lead_id: 'lead-1',
        code_hint: 'OLD1',
        plan_id: 'annual',
        duration_months: 6,
        agreed_price: null,
        store_name: null,
        username: null,
        status: 'redeemed',
        code_expires_at: '',
        subscription_end_at: null,
        redeemed_at: '2026-01-01',
        redeemed_user_id: 'user-1',
        created_at: '2026-01-01',
      },
      {
        id: '2',
        lead_id: 'lead-1',
        code_hint: 'NEW1',
        plan_id: 'yearly',
        duration_months: 12,
        agreed_price: null,
        store_name: null,
        username: null,
        status: 'redeemed',
        code_expires_at: '',
        subscription_end_at: null,
        redeemed_at: '2026-06-01',
        redeemed_user_id: 'user-1',
        created_at: '2026-06-01',
      },
    ];
    expect(getLastRedeemedAccessCode(codes)?.code_hint).toBe('NEW1');
  });
});
