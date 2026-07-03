import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';

export const planLabelFor = (planId: string): string =>
  PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.name ??
  (planId === 'yearly' ? 'باقة سنوية' : planId === 'annual' ? 'باقة 6 أشهر' : planId);

export const getSubscriptionRemainingDays = (endDate: string | null | undefined): number | null => {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};
