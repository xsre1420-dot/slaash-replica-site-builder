import { supabase } from '@/integrations/supabase/client';
import type { SubscriptionRecord, SubscriptionStatus } from '@/types/leads';

export type MerchantAccessState = {
  loading: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  subscription: SubscriptionRecord | null;
};

export const fetchMerchantAccess = async (): Promise<MerchantAccessState> => {
  const { data, error } = await (supabase as any).rpc('get_my_subscription');

  if (error) {
    return { loading: false, isAdmin: false, hasAccess: false, subscription: null };
  }

  const payload = data as {
    success?: boolean;
    is_admin?: boolean;
    has_access?: boolean;
    subscription?: SubscriptionRecord | null;
  };

  return {
    loading: false,
    isAdmin: Boolean(payload?.is_admin),
    hasAccess: Boolean(payload?.has_access || payload?.is_admin),
    subscription: (payload?.subscription as SubscriptionRecord) ?? null,
  };
};

export const isSubscriptionExpired = (sub: SubscriptionRecord | null): boolean => {
  if (!sub) return true;
  if (sub.status === 'expired' || sub.status === 'suspended') return true;
  if (sub.end_date && new Date(sub.end_date) < new Date()) return true;
  return sub.status !== 'active';
};

export const subscriptionStatusLabel = (status: SubscriptionStatus): string => {
  const map: Record<SubscriptionStatus, string> = {
    active: 'نشط',
    expired: 'منتهي',
    suspended: 'موقوف',
  };
  return map[status] ?? status;
};
