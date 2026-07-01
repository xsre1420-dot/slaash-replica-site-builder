import { describe, expect, it } from 'vitest';
import {
  accessCodeBlockReason,
  canCreateAccessCodeForLead,
  leadHasPendingAccessCode,
} from './leadAccessCodeUtils';

describe('leadAccessCodeUtils', () => {
  it('allows code creation for fresh leads', () => {
    expect(canCreateAccessCodeForLead({ converted_user_id: null, has_pending_code: false })).toBe(true);
    expect(accessCodeBlockReason({ converted_user_id: null, has_pending_code: false })).toBeNull();
  });

  it('blocks when customer already activated', () => {
    expect(
      canCreateAccessCodeForLead({ converted_user_id: 'user-1', has_pending_code: false })
    ).toBe(false);
    expect(accessCodeBlockReason({ converted_user_id: 'user-1', has_pending_code: false })).toBe(
      'converted'
    );
  });

  it('blocks duplicate code while an active code is pending', () => {
    expect(
      canCreateAccessCodeForLead({ converted_user_id: null, has_pending_code: true })
    ).toBe(false);
    expect(leadHasPendingAccessCode({ has_pending_code: true })).toBe(true);
    expect(accessCodeBlockReason({ converted_user_id: null, has_pending_code: true })).toBe(
      'pending'
    );
  });
});
