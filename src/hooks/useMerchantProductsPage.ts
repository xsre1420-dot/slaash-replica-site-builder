import { useCallback, useEffect, useState } from 'react';
import { Product } from '@/types';
import { PRODUCTS_PAGE_SIZE, loadProductsPage, getProductsSync, invalidateProducts } from '@/services/productService';
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
  category: string
): MerchantProductsPageState {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean, force = false) => {
      if (!user?.id) {
        setProducts([]);
        setTotal(0);
        setHasMore(false);
        setLoading(false);
        return;
      }

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const result = await loadProductsPage(
          pageNum,
          PRODUCTS_PAGE_SIZE,
          force,
          search?.trim() || undefined,
          category !== 'all' ? category : undefined
        );

        setProducts((prev) => (append ? [...prev, ...result.products] : result.products));
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPage(pageNum);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?.id, search, category]
  );

  const reload = useCallback(async () => {
    await invalidateProducts();
    await fetchPage(0, false, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    await fetchPage(page + 1, true);
  }, [hasMore, loadingMore, loading, page, fetchPage]);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    void fetchPage(0, false);
  }, [isReady, hydrationVersion, user?.id, fetchPage]);

  const syncFromCache = useCallback(() => {
    const synced = getProductsSync();
    if (synced.length > 0) {
      setProducts(synced);
    }
  }, []);

  return {
    products,
    total,
    hasMore,
    page,
    loading,
    loadingMore,
    reload,
    loadMore,
    syncFromCache,
  };
}
