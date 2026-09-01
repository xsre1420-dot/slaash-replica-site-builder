/**
 * Marketing page bundle — coupons, product discounts, and settings in one coordinated load.
 */
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { listMerchantCoupons, type MerchantCoupon } from '@/services/couponService';
import {
  fetchDiscountProducts,
  fetchMerchantMarketingSettings,
  type DiscountProductRow,
  type MerchantMarketingSettings,
} from '@/services/marketingService';

export type MarketingPageBundle = {
  coupons: MerchantCoupon[];
  discountProducts: DiscountProductRow[];
  marketingSettings: MerchantMarketingSettings | null;
};

export function peekMarketingPageBundle(ownerId: string): MarketingPageBundle | null {
  return cache.get<MarketingPageBundle>(CacheKeys.marketingPage(ownerId));
}

export function invalidateMarketingPageBundle(ownerId: string): void {
  const key = CacheKeys.marketingPage(ownerId);
  cache.del(key);
  clearInflight(key);
}

/** Single deduped marketing hub load for initial page render. */
export async function loadMarketingPageBundle(
  ownerId: string,
  options?: { force?: boolean }
): Promise<MarketingPageBundle | null> {
  const key = CacheKeys.marketingPage(ownerId);

  if (!options?.force) {
    const peek = peekMarketingPageBundle(ownerId);
    if (peek) return peek;
  } else {
    invalidateMarketingPageBundle(ownerId);
  }

  return dedup(key, async () => {
    const [coupons, discountProducts, marketingSettings] = await Promise.all([
      listMerchantCoupons(ownerId),
      fetchDiscountProducts(ownerId),
      fetchMerchantMarketingSettings(ownerId),
    ]);

    const bundle: MarketingPageBundle = {
      coupons,
      discountProducts,
      marketingSettings,
    };
    cache.set(key, bundle, CacheTTL.MEDIUM, CacheTTL.STALE);
    return bundle;
  });
}
