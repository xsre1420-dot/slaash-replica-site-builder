import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import type { LeadRecord } from '@/types/leads';

/** Display label for a plan ID or legacy stored name — always includes duration when known. */
export const planLabelFor = (planIdOrName: string): string => {
  const plan = PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === planIdOrName);
  if (plan) return `${plan.name} — ${plan.toggleLabel}`;

  const normalized = planIdOrName.trim().toLowerCase();
  if (normalized === 'yearly' || planIdOrName.includes('سنو')) return 'باقة سنوية';
  if (normalized === 'annual' || planIdOrName.includes('6')) return 'باقة 6 أشهر';

  return planIdOrName;
};

/** Prefer selected_plan_id (source of truth) over display name from DB. */
export const planLabelForLead = (lead: Pick<LeadRecord, 'selected_plan_id' | 'selected_plan_name'>): string => {
  if (lead.selected_plan_id) return planLabelFor(lead.selected_plan_id);
  if (lead.selected_plan_name) return planLabelFor(lead.selected_plan_name);
  return '—';
};

export const getSubscriptionRemainingDays = (endDate: string | null | undefined): number | null => {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};
