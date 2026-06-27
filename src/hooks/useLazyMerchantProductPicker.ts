import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { loadProductsPage, PRODUCTS_PAGE_SIZE } from '@/services/productService';
import { getProductLifecycleStatus } from '@/lib/productLifecycle';
import type { Product } from '@/types';
import type { MerchantProductSelectProfile } from '@/lib/productUpdateUtils';

export interface LazyMerchantProductPickerOptions {
  profile?: MerchantProductSelectProfile;
  /** When set, only products matching this lifecycle are returned. */
  lifecycle?: 'published' | 'all';
  enabled?: boolean;
  pageSize?: number;
}

/**
 * Server-side paginated product picker — one page at a time with keyset cursor.
 * Never loads the full merchant catalog.
 */
export function useLazyMerchantProductPicker(options: LazyMerchantProductPickerOptions = {}) {
  const profile = options.profile ?? 'grid';
  const lifecycleFilter = options.lifecycle ?? 'all';
  const enabled = options.enabled ?? true;
  const pageSize = options.pageSize ?? PRODUCTS_PAGE_SIZE;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const pageRef = useRef(0);
  const canUseKeyset = !debouncedSearch.trim();

  const applyLifecycleFilter = useCallback(
    (items: Product[]) =>
      lifecycleFilter === 'published'
        ? items.filter((p) => getProductLifecycleStatus(p) === 'published')
        : items,
    [lifecycleFilter]
  );

  const fetchPage = useCallback(
    async (append: boolean, force = false) => {
      if (!enabled) return;

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const pageNum = append ? pageRef.current + 1 : 0;
        const cursor = append && canUseKeyset ? nextCursorRef.current : null;

        const result = await loadProductsPage(
          pageNum,
          pageSize,
          force,
          debouncedSearch.trim() || undefined,
          undefined,
          profile,
          cursor
        );

        const pageProducts = applyLifecycleFilter(result.products);
        setProducts((prev) => (append ? [...prev, ...pageProducts] : pageProducts));
        setHasMore(result.hasMore);
        pageRef.current = pageNum;
        nextCursorRef.current = result.nextCursor ?? null;
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [enabled, pageSize, debouncedSearch, profile, canUseKeyset, applyLifecycleFilter]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    void fetchPage(true);
  }, [hasMore, loadingMore, loading, fetchPage]);

  const reload = useCallback(() => {
    nextCursorRef.current = null;
    pageRef.current = 0;
    return fetchPage(false, true);
  }, [fetchPage]);

  useEffect(() => {
    nextCursorRef.current = null;
    pageRef.current = 0;
    if (enabled) void fetchPage(false, true);
  }, [debouncedSearch, enabled, fetchPage]);

  return {
    products,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    reload,
    search,
    setSearch,
  };
}
