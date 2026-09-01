import { callReadRpc } from '@/lib/readWrite/readClient';
import { getAuthenticatedUserId } from '@/lib/authSession';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
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

const emptyAccess = (): MerchantAccessState => ({
  loading: false,
  isAdmin: false,
  hasAccess: false,
  subscription: null,
  accessError: null,
});

function normalizeAccessPayload(data: unknown): MerchantAccessState {
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
}

export function peekMerchantAccess(userId: string): MerchantAccessState | null {
  if (!userId) return null;
  return cache.get<MerchantAccessState>(CacheKeys.merchantAccess(userId));
}

export function invalidateMerchantAccess(userId?: string): void {
  if (userId) {
    cache.del(CacheKeys.merchantAccess(userId));
    clearInflight(CacheKeys.merchantAccess(userId));
    return;
  }
  cache.flushByPrefix('merchant-access:');
}

export const fetchMerchantAccess = async (options?: {
  userId?: string;
  force?: boolean;
}): Promise<MerchantAccessState> => {
  const userId = options?.userId ?? (await getAuthenticatedUserId());
  if (!userId) return emptyAccess();

  const key = CacheKeys.merchantAccess(userId);

  if (!options?.force) {
    const peek = peekMerchantAccess(userId);
    if (peek) return peek;
  } else {
    invalidateMerchantAccess(userId);
  }

  return dedup(key, async () => {
    const { data, error } = await callReadRpc('get_my_subscription');

    if (error) {
      const failed: MerchantAccessState = {
        ...emptyAccess(),
        accessError: 'rpc_failed',
      };
      cache.set(key, failed, CacheTTL.SHORT, CacheTTL.STALE);
      return failed;
    }

    const state = normalizeAccessPayload(data);
    cache.set(key, state, CacheTTL.MEDIUM, CacheTTL.STALE);
    return state;
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry access check after redeem — avoids spurious logout when RPC lags behind edge write. */
export const fetchMerchantAccessWithRetry = async (
  userId?: string,
  attempts = 4,
  delayMs = 400
): Promise<MerchantAccessState> => {
  invalidateMerchantAccess(userId);
  let last = await fetchMerchantAccess({ userId, force: true });
  for (let i = 1; i < attempts && !last.hasAccess && !last.isAdmin && !last.accessError; i += 1) {
    await sleep(delayMs * i);
    last = await fetchMerchantAccess({ userId, force: true });
  }
  return last;
};

export { isSubscriptionExpired };
