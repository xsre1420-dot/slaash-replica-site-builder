/**
 * Login page bundle — subscription access gate for session redirect.
 */
import {
  fetchMerchantAccess,
  peekMerchantAccess,
  type MerchantAccessState,
} from '@/services/subscriptionService';

export type LoginPageBundle = MerchantAccessState;

export function peekLoginPageBundle(userId: string): LoginPageBundle | null {
  return peekMerchantAccess(userId);
}

/** Coordinated access check for /login and /subscription-expired gates. */
export async function loadLoginPageBundle(
  userId: string,
  options?: { force?: boolean }
): Promise<LoginPageBundle> {
  if (!options?.force) {
    const peek = peekLoginPageBundle(userId);
    if (peek) return peek;
  }
  return fetchMerchantAccess({ userId, force: options?.force });
}
