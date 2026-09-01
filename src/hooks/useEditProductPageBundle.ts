import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import type { Category } from '@/types';
import type { Product } from '@/types';
import {
  loadEditProductPageBundle,
  peekEditProductPageBundle,
  refreshEditProductPageCategories,
  type EditProductPageBundle,
} from '@/services/editProductPageService';

export type EditProductPageState = {
  loading: boolean;
  bundle: EditProductPageBundle | null;
  product: Product | null;
  categories: Category[];
  refetch: () => Promise<EditProductPageBundle | null>;
  refreshCategories: () => Promise<Category[]>;
};

export function useEditProductPageBundle(productId: string | undefined): EditProductPageState {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const ownerId = user?.id;

  const [bundle, setBundle] = useState<EditProductPageBundle | null>(() =>
    ownerId && productId ? peekEditProductPageBundle(ownerId, productId) : null
  );
  const [loading, setLoading] = useState(() => !bundle && !!ownerId && !!productId);

  useEffect(() => {
    if (!ownerId || !productId) {
      setLoading(false);
      return;
    }
    if (!isReady) {
      setLoading(true);
      return;
    }

    const cached = peekEditProductPageBundle(ownerId, productId);
    if (cached) {
      setBundle(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadEditProductPageBundle(ownerId, productId).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isReady, hydrationVersion, ownerId, productId]);

  const refetch = useCallback(async () => {
    if (!ownerId || !productId) return null;
    setLoading(true);
    try {
      const loaded = await loadEditProductPageBundle(ownerId, productId, { force: true });
      setBundle(loaded);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, [ownerId, productId]);

  const refreshCategories = useCallback(async () => {
    if (!ownerId || !productId) return [];
    const categories = await refreshEditProductPageCategories(ownerId, productId);
    setBundle((prev) => (prev ? { ...prev, categories } : prev));
    return categories;
  }, [ownerId, productId]);

  return useMemo(
    () => ({
      loading,
      bundle,
      product: bundle?.product ?? null,
      categories: bundle?.categories ?? [],
      refetch,
      refreshCategories,
    }),
    [loading, bundle, refetch, refreshCategories]
  );
}

export { invalidateEditProductPageBundle } from '@/services/editProductPageService';
