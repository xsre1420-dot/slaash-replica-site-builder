import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import type { Category } from '@/types';
import {
  loadPreviewStorePageBundle,
  peekPreviewStorePageBundle,
  invalidatePreviewStorePageBundle,
  previewCategoriesWithAll,
  type PreviewStorePageBundle,
} from '@/services/previewStorePageService';

export type PreviewStorePageState = {
  loading: boolean;
  bundle: PreviewStorePageBundle | null;
  categories: Category[];
  storeSlug: string | undefined;
  refetch: () => Promise<PreviewStorePageBundle | null>;
};

export function usePreviewStorePageBundle(): PreviewStorePageState {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const ownerId = user?.id;

  const [bundle, setBundle] = useState<PreviewStorePageBundle | null>(() =>
    ownerId ? peekPreviewStorePageBundle(ownerId) : null
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

    const cached = peekPreviewStorePageBundle(ownerId);
    if (cached) {
      setBundle(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadPreviewStorePageBundle(ownerId).then((loaded) => {
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
      const loaded = await loadPreviewStorePageBundle(ownerId, { force: true });
      setBundle(loaded);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  const categories = useMemo(
    () => previewCategoriesWithAll(bundle?.categories ?? []),
    [bundle?.categories]
  );

  return useMemo(
    () => ({
      loading,
      bundle,
      categories,
      storeSlug: bundle?.storeSlug ?? undefined,
      refetch,
    }),
    [loading, bundle, categories, refetch]
  );
}

export { invalidatePreviewStorePageBundle } from '@/services/previewStorePageService';
