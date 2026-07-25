import { describe, it, expect } from 'vitest';
import { planLabelFor, planLabelForLead, getSubscriptionRemainingDays } from '@/utils/subscriptionPlanLabels';
import { isSubscriptionExpired } from '@/utils/subscriptionExpiryUtils';

describe('subscriptionPlanLabels', () => {
  it('labels annual and yearly plans', () => {
    expect(planLabelFor('annual')).toContain('6');
    expect(planLabelFor('yearly')).toMatch(/سنة|سنو/);
  });

  it('computes remaining days', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(getSubscriptionRemainingDays(future)).toBeGreaterThanOrEqual(9);
    expect(getSubscriptionRemainingDays(null)).toBeNull();
  });

  it('prefers selected_plan_id for lead display', () => {
    expect(
      planLabelForLead({
        selected_plan_id: 'yearly',
        selected_plan_name: 'باقة 6 أشهر',
      })
    ).toMatch(/سنة|سنو/);
  });
});

describe('subscriptionExpiryUtils', () => {
  it('detects expired subscription', () => {
    expect(
      isSubscriptionExpired({
        id: '1',
        user_id: 'u',
        plan_name: 'annual',
        start_date: '2020-01-01',
        end_date: '2020-06-01',
        status: 'active',
        lead_id: null,
        converted_at: null,
        notes: null,
        created_at: '2020-01-01',
      })
    ).toBe(true);
  });
});
