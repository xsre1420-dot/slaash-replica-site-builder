import { callReadRpc } from '@/lib/readWrite/readClient';
import type { SubscriptionRecord } from '@/types/leads';
import { isSubscriptionExpired } from '@/utils/subscriptionExpiryUtils';

export type MerchantAccessState = {
  loading: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  subscription: SubscriptionRecord | null;
  /** Set when RPC failed (network/schema) — distinct from expired subscription */
  accessError?: 'rpc_failed' | null;
};

export const fetchMerchantAccess = async (): Promise<MerchantAccessState> => {
  const { data, error } = await callReadRpc('get_my_subscription');

  if (error) {
    return {
      loading: false,
      isAdmin: false,
      hasAccess: false,
      subscription: null,
      accessError: 'rpc_failed',
    };
  }

  const payload = data as {
    success?: boolean;
    is_admin?: boolean;
    has_access?: boolean;
    subscription?: SubscriptionRecord | null;
  };

  const subscription = (payload?.subscription as SubscriptionRecord) ?? null;

  return {
    loading: false,
    isAdmin: Boolean(payload?.is_admin),
    hasAccess: Boolean(payload?.has_access || payload?.is_admin),
    subscription,
    accessError: null,
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry access check after redeem — avoids spurious logout when RPC lags behind edge write. */
export const fetchMerchantAccessWithRetry = async (
  attempts = 4,
  delayMs = 400
): Promise<MerchantAccessState> => {
  let last = await fetchMerchantAccess();
  for (let i = 1; i < attempts && !last.hasAccess && !last.isAdmin; i += 1) {
    await sleep(delayMs * i);
    last = await fetchMerchantAccess();
  }
  return last;
};

export { isSubscriptionExpired };
