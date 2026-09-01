import { useCallback, useEffect, useState } from 'react';
import { Product } from '@/types';
import {
  loadCheckoutPageBundle,
  peekCheckoutPageBundle,
  type CheckoutPageBundle,
  type CheckoutPageInit,
} from '@/services/checkoutPageService';

export type CheckoutPageState = {
  ready: boolean;
  loading: boolean;
  bundle: CheckoutPageBundle | null;
  init: CheckoutPageInit | null;
  freshProducts: Map<string, Product>;
  refetch: () => Promise<CheckoutPageBundle | null>;
};

export function useCheckoutPageBundle(options: {
  storeSlug?: string;
  ownerId?: string;
  productIds: string[];
  cartKey: string;
  cartFallback?: Map<string, Product>;
  enabled?: boolean;
}): CheckoutPageState {
  const { storeSlug, ownerId, productIds, cartKey, cartFallback, enabled = true } = options;

  const [bundle, setBundle] = useState<CheckoutPageBundle | null>(() => {
    if (!enabled) return null;
    return peekCheckoutPageBundle({ storeSlug, ownerId, cartKey });
  });
  const [loading, setLoading] = useState(() => enabled && !bundle && productIds.length > 0);
  const [ready, setReady] = useState(() => !enabled || productIds.length === 0 || !!bundle);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      setLoading(false);
      return;
    }

    if (productIds.length === 0) {
      setBundle(null);
      setReady(true);
      setLoading(false);
      return;
    }

    if (!storeSlug && !ownerId) {
      setReady(false);
      return;
    }

    const peek = peekCheckoutPageBundle({ storeSlug, ownerId, cartKey });
    if (peek) {
      setBundle(peek);
      setReady(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setReady(false);

    void loadCheckoutPageBundle({
      storeSlug,
      ownerId,
      productIds,
      cartKey,
      cartFallback,
    }).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setReady(true);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, storeSlug, ownerId, cartKey, productIds, cartFallback]);

  const refetch = useCallback(async () => {
    if (!storeSlug && !ownerId) return null;
    setLoading(true);
    try {
      const loaded = await loadCheckoutPageBundle({
        storeSlug,
        ownerId,
        productIds,
        cartKey,
        cartFallback,
        force: true,
      });
      setBundle(loaded);
      setReady(true);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, [storeSlug, ownerId, productIds, cartKey, cartFallback]);

  return {
    ready,
    loading,
    bundle,
    init: bundle?.init ?? null,
    freshProducts: bundle?.freshProducts ?? new Map(),
    refetch,
  };
}
