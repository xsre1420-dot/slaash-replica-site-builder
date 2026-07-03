import type { SubscriptionRecord } from '@/types/leads';

export const isSubscriptionExpired = (sub: SubscriptionRecord | null): boolean => {
  if (!sub) return true;
  if (sub.status === 'expired' || sub.status === 'suspended') return true;
  if (sub.end_date && new Date(sub.end_date) < new Date()) return true;
  return sub.status !== 'active';
};
