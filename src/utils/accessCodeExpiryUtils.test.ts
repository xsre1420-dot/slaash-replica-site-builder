import { describe, it, expect } from 'vitest';
import {
  getRemainingSubscriptionMonths,
  isFarFutureExpiry,
  canUseAccessCodeByExpiry,
  getAccessCodeEffectiveEnd,
} from '@/utils/accessCodeExpiryUtils';

describe('accessCodeExpiryUtils', () => {
  it('detects far-future placeholder expiry', () => {
    expect(isFarFutureExpiry('2099-12-31T23:59:59Z')).toBe(true);
    expect(isFarFutureExpiry('2026-12-31T23:59:59Z')).toBe(false);
  });

  it('computes remaining months from end date', () => {
    const inFiveMonths = new Date();
    inFiveMonths.setMonth(inFiveMonths.getMonth() + 5);
    expect(getRemainingSubscriptionMonths(inFiveMonths)).toBeGreaterThanOrEqual(5);
  });

  it('rejects active codes past subscription end', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      canUseAccessCodeByExpiry({
        status: 'active',
        subscription_end_at: past,
        code_expires_at: past,
      })
    ).toBe(false);
  });

  it('uses subscription_end_at over code_expires_at', () => {
    const end = getAccessCodeEffectiveEnd({
      subscription_end_at: '2026-08-01T00:00:00Z',
      code_expires_at: '2026-07-01T00:00:00Z',
    });
    expect(end?.toISOString()).toBe(new Date('2026-08-01T00:00:00Z').toISOString());
  });
});
