import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Product } from '@/types';
import { PRODUCTS_PAGE_SIZE, loadProductsPage, getProductsSync, invalidateProducts } from '@/services/productService';
import type { MerchantProductSelectProfile } from '@/lib/productUpdateUtils';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import { useAuth } from '@/context/AuthContext';

export interface MerchantProductsPageState {
  products: Product[];
  total: number;
  hasMore: boolean;
  page: number;
  loading: boolean;
  loadingMore: boolean;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  syncFromCache: () => void;
}

export function useMerchantProductsPage(
  search: string,
  category: string,
  options?: { profile?: MerchantProductSelectProfile; enabled?: boolean }
): MerchantProductsPageState {
  const profile = options?.profile ?? 'grid';
  const enabled = options?.enabled ?? true;
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const warmFirstPage = enabled ? getProductsSync() : [];
  const [products, setProducts] = useState<Product[]>(() => warmFirstPage);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(() => enabled && warmFirstPage.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const canUseKeyset = !search?.trim() && (!category || category === 'all');

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean, force = false, cursor?: string | null) => {
      if (!user?.id || !enabled) {
        setProducts([]);
        setTotal(0);
        setHasMore(false);
        setLoading(false);
        nextCursorRef.current = null;
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else if (force || pageNum > 0 || search?.trim() || (category && category !== 'all')) {
        setLoading(true);
      } else if (getProductsSync().length === 0) {
        setLoading(true);
      }

      try {
        const useCursor = cursor ?? (append && canUseKeyset ? nextCursorRef.current : null);
        const result = await loadProductsPage(
          pageNum,
          PRODUCTS_PAGE_SIZE,
          force,
          search?.trim() || undefined,
          category !== 'all' ? category : undefined,
          profile,
          useCursor
        );

        setProducts((prev) => (append ? [...prev, ...result.products] : result.products));
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPage(pageNum);
        nextCursorRef.current = result.nextCursor ?? null;
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?.id, search, category, profile, canUseKeyset, enabled]
  );

  const reload = useCallback(async () => {
    nextCursorRef.current = null;
    await invalidateProducts();
    await fetchPage(0, false, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    await fetchPage(page + 1, true);
  }, [hasMore, loadingMore, loading, page, fetchPage]);

  useEffect(() => {
    nextCursorRef.current = null;
  }, [search, category, profile]);

  useEffect(() => {
    if (!isReady || !user?.id || !enabled) return;
    const warm = getProductsSync();
    const hasWarmCache =
      warm.length > 0 && !search?.trim() && (!category || category === 'all');
    if (hasWarmCache) {
      setProducts(warm);
      setLoading(false);
      return;
    }
    void fetchPage(0, false);
  }, [isReady, hydrationVersion, user?.id, fetchPage, enabled, search, category]);

  const syncFromCache = useCallback(() => {
    const synced = getProductsSync();
    if (synced.length > 0) {
      setProducts(synced);
    }
  }, []);

  return useMemo(
    () => ({
      products,
      total,
      hasMore,
      page,
      loading,
      loadingMore,
      reload,
      loadMore,
      syncFromCache,
    }),
    [
      products,
      total,
      hasMore,
      page,
      loading,
      loadingMore,
      reload,
      loadMore,
      syncFromCache,
    ]
  );
}
