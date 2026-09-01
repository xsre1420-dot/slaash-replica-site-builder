import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import {
  loadInventoryPageBundle,
  peekInventoryPageBundle,
  invalidateInventoryPageBundle,
  type InventoryPageBundle,
} from '@/services/inventoryPageService';

export type InventoryPageState = {
  loading: boolean;
  bundle: InventoryPageBundle | null;
  categories: InventoryPageBundle['categories'];
  pendingReviewsCount: number;
  refetch: () => Promise<InventoryPageBundle | null>;
};

export function useInventoryPageBundle(): InventoryPageState {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const ownerId = user?.id;

  const [bundle, setBundle] = useState<InventoryPageBundle | null>(() =>
    ownerId ? peekInventoryPageBundle(ownerId) : null
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

    const cached = peekInventoryPageBundle(ownerId);
    if (cached) {
      setBundle(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadInventoryPageBundle(ownerId).then((loaded) => {
      if (cancelled) return;
      setBundle(loaded);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isReady, hydrationVersion, ownerId]);

  const refetch = useCallback(async () => {
    if (!ownerId) return null;
    setLoading(true);
    try {
      const loaded = await loadInventoryPageBundle(ownerId, { force: true });
      setBundle(loaded);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  return useMemo(
    () => ({
      loading,
      bundle,
      categories: bundle?.categories ?? [],
      pendingReviewsCount: bundle?.pendingReviewsCount ?? 0,
      refetch,
    }),
    [loading, bundle, refetch]
  );
}

export { invalidateInventoryPageBundle };
