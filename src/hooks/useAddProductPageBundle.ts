import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import type { Category } from '@/types';
import type { DeliveryPrice } from '@/utils/deliveryUtils';
import { hasConfiguredDeliveryPrices } from '@/utils/deliveryUtils';
import {
  loadAddProductPageBundle,
  peekAddProductPageBundle,
  refreshAddProductPageCategories,
  type AddProductPageBundle,
} from '@/services/addProductPageService';

export type AddProductPageState = {
  loading: boolean;
  categories: Category[];
  deliveryPrices: DeliveryPrice[];
  deliveryConfigured: boolean;
  catalogEmpty: boolean;
  refreshCategories: () => Promise<Category[]>;
};

export function useAddProductPageBundle(): AddProductPageState {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const ownerId = user?.id;

  const [bundle, setBundle] = useState<AddProductPageBundle | null>(() =>
    ownerId ? peekAddProductPageBundle(ownerId) : null
  );
  const [loading, setLoading] = useState(() => !bundle && !!ownerId);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return;
    }
    if (!isReady) {
      setLoading(true);
      return;
    }

    const cached = peekAddProductPageBundle(ownerId);
    if (cached) {
      setBundle(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadAddProductPageBundle(ownerId).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isReady, hydrationVersion, ownerId]);

  const refreshCategories = useCallback(async () => {
    if (!ownerId) return [];
    const categories = await refreshAddProductPageCategories(ownerId);
    setBundle((prev) => (prev ? { ...prev, categories } : prev));
    return categories;
  }, [ownerId]);

  return useMemo(
    () => ({
      loading,
      categories: bundle?.categories ?? [],
      deliveryPrices: bundle?.deliveryPrices ?? [],
      deliveryConfigured: hasConfiguredDeliveryPrices(bundle?.deliveryPrices),
      catalogEmpty: bundle != null && bundle.productCount === 0,
      refreshCategories,
    }),
    [loading, bundle, refreshCategories]
  );
}
