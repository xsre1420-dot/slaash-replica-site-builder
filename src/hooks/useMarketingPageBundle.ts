import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import type { MerchantCoupon } from '@/services/couponService';
import type { DiscountProductRow, MerchantMarketingSettings } from '@/services/marketingService';
import {
  loadMarketingPageBundle,
  peekMarketingPageBundle,
  invalidateMarketingPageBundle,
  type MarketingPageBundle,
} from '@/services/marketingPageService';

export type MarketingPageState = {
  loading: boolean;
  ready: boolean;
  bundle: MarketingPageBundle | null;
  coupons: MerchantCoupon[];
  discountProducts: DiscountProductRow[];
  marketingSettings: MerchantMarketingSettings | null;
  setCoupons: (coupons: MerchantCoupon[]) => void;
  setDiscountProducts: (products: DiscountProductRow[]) => void;
  setMarketingSettings: (settings: MerchantMarketingSettings | null) => void;
  refetch: () => Promise<MarketingPageBundle | null>;
};

const MarketingPageContext = createContext<MarketingPageState | null>(null);

export function MarketingPageProvider({
  value,
  children,
}: {
  value: MarketingPageState;
  children: ReactNode;
}) {
  return (
    <MarketingPageContext.Provider value={value}>
      {children}
    </MarketingPageContext.Provider>
  );
}

export function useMarketingPage(): MarketingPageState {
  const ctx = useContext(MarketingPageContext);
  if (!ctx) {
    throw new Error('useMarketingPage must be used within MarketingPageProvider');
  }
  return ctx;
}

export function useMarketingPageBundle(): MarketingPageState {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const ownerId = user?.id;

  const [bundle, setBundle] = useState<MarketingPageBundle | null>(() =>
    ownerId ? peekMarketingPageBundle(ownerId) : null
  );
  const [loading, setLoading] = useState(() => !bundle && !!ownerId);

  useEffect(() => {
    if (!ownerId) {
      setBundle(null);
      setLoading(false);
      return;
    }
    if (!isReady) {
      setLoading(true);
      return;
    }

    const cached = peekMarketingPageBundle(ownerId);
    if (cached) {
      setBundle(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadMarketingPageBundle(ownerId).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isReady, hydrationVersion, ownerId]);

  const setCoupons = useCallback(
    (coupons: MerchantCoupon[]) => {
      setBundle((prev) => {
        if (!prev) return prev;
        const next = { ...prev, coupons };
        if (ownerId) cache.setBundle(ownerId, next);
        return next;
      });
    },
    [ownerId]
  );

  const setDiscountProducts = useCallback(
    (discountProducts: DiscountProductRow[]) => {
      setBundle((prev) => {
        if (!prev) return prev;
        const next = { ...prev, discountProducts };
        if (ownerId) cacheSetBundle(ownerId, next);
        return next;
      });
    },
    [ownerId]
  );

  const setMarketingSettings = useCallback(
    (marketingSettings: MerchantMarketingSettings | null) => {
      setBundle((prev) => {
        if (!prev) return prev;
        const next = { ...prev, marketingSettings };
        if (ownerId) cacheSetBundle(ownerId, next);
        return next;
      });
    },
    [ownerId]
  );

  const refetch = useCallback(async () => {
    if (!ownerId) return null;
    setLoading(true);
    try {
      const loaded = await loadMarketingPageBundle(ownerId, { force: true });
      setBundle(loaded);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  return useMemo(
    () => ({
      loading,
      ready: !loading && !!ownerId,
      bundle,
      coupons: bundle?.coupons ?? [],
      discountProducts: bundle?.discountProducts ?? [],
      marketingSettings: bundle?.marketingSettings ?? null,
      setCoupons,
      setDiscountProducts,
      setMarketingSettings,
      refetch,
    }),
    [
      loading,
      ownerId,
      bundle,
      setCoupons,
      setDiscountProducts,
      setMarketingSettings,
      refetch,
    ]
  );
}

function cacheSetBundle(ownerId: string, bundle: MarketingPageBundle): void {
  const { cache, CacheKeys, CacheTTL } = require('@/lib/cache') as typeof import('@/lib/cache');
  cache.set(CacheKeys.marketingPage(ownerId), bundle, CacheTTL.MEDIUM, CacheTTL.STALE);
}

export { invalidateMarketingPageBundle } from '@/services/marketingPageService';
export type { MarketingPageBundle } from '@/services/marketingPageService';
