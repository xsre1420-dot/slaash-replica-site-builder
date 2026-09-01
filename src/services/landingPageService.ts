/**
 * Landing page bundle — public pricing catalog and contact config (no network).
 */
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import {
  PUBLIC_SUBSCRIPTION_PLANS,
  type PublicSubscriptionPlan,
} from '@/data/subscriptionPlans';

export type LandingPageBundle = {
  plans: PublicSubscriptionPlan[];
  salesWhatsApp: string;
};

function buildLandingBundle(): LandingPageBundle {
  return {
    plans: PUBLIC_SUBSCRIPTION_PLANS,
    salesWhatsApp: import.meta.env.VITE_SALES_WHATSAPP || '9647700000000',
  };
}

export function peekLandingPageBundle(): LandingPageBundle | null {
  return cache.get<LandingPageBundle>(CacheKeys.landingPage());
}

/** Sync/coordinated entry for home + request-access initial render. */
export function loadLandingPageBundle(): LandingPageBundle {
  const peek = peekLandingPageBundle();
  if (peek) return peek;

  const bundle = buildLandingBundle();
  cache.set(CacheKeys.landingPage(), bundle, CacheTTL.LONG, CacheTTL.STALE);
  return bundle;
}

export function invalidateLandingPageBundle(): void {
  cache.del(CacheKeys.landingPage());
}
