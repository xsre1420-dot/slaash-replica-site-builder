import { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '@/types';
import { cache, CacheTTL } from '@/lib/cache';
import { cacheGet, cacheSet, cacheDeleteByPrefix } from '@/utils/indexedDB';
import { ProductCacheKeys } from '@/services/storefrontCacheTiers';
import {
  fetchStorefrontProductsPage,
  getStorefrontFirstPageFromCache,
  ensureStorefrontPageBundle,
  STOREFRONT_PRODUCTS_CHANGED,
  type StorefrontInvalidationScope,
} from '@/services/storefrontProductService';
import { awaitStorefrontBundleReady } from '@/lib/storefront/storefrontLoadCoordinator';

const PAGE_SIZE = 24;
const PRODUCTS_IDB_TTL = 5 * 60 * 1000;

interface UseStoreProductsPageOptions {
  category?: string;
  search?: string;
  enabled?: boolean;
}

export const useStoreProductsPage = (
  slug: string | undefined,
  options: UseStoreProductsPageOptions = {}
) => {
  const { category, search, enabled = true } = options;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const requestKeyRef = useRef('');

  const normalizedSlug = slug?.trim().toLowerCase() || '';
  const categoryFilter = category && category !== 'all' ? category : undefined;
  const searchFilter = search?.trim() || undefined;

  const fetchPage = useCallback(
    async (append = false, cursor: string | null = null, force = false) => {
      if (!normalizedSlug || !/^[a-z0-9-]+$/.test(normalizedSlug)) {
        setLoading(false);
        setError('رابط المتجر غير صالح');
        return;
      }

      const reqKey = `${normalizedSlug}:${categoryFilter || ''}:${searchFilter || ''}:${cursor || 'start'}`;
      requestKeyRef.current = reqKey;

      if (append) setLoadingMore(true);
      else setLoading(true);

      const cacheKey = ProductCacheKeys.tenantPage(
        normalizedSlug,
        categoryFilter || '',
        searchFilter || '',
        cursor || 'start'
      );
      const idbKey = ProductCacheKeys.idbPage(
        normalizedSlug,
        categoryFilter || '',
        searchFilter || '',
        cursor || 'start'
      );

      try {
        if (!force && !append) {
          const idbCached = await cacheGet<{
            products: Product[];
            nextCursor: string | null;
            hasMore: boolean;
          }>(idbKey, PRODUCTS_IDB_TTL);
          if (idbCached?.products?.length) {
            setProducts(idbCached.products);
            cursorRef.current = idbCached.nextCursor;
            setHasMore(!!idbCached.hasMore);
            setError(null);
            setLoading(false);
            setLoadingMore(false);
            return;
          }

          const cached = cache.get<{
            products: Product[];
            nextCursor: string | null;
            hasMore: boolean;
          }>(cacheKey);
          if (cached?.products?.length) {
            setProducts(cached.products);
            cursorRef.current = cached.nextCursor;
            setHasMore(!!cached.hasMore);
            setError(null);
            setLoading(false);
            setLoadingMore(false);
            return;
          }
        }

        const result = await fetchStorefrontProductsPage(normalizedSlug, {
          limit: PAGE_SIZE,
          cursor,
          category: categoryFilter,
          search: searchFilter,
        });

        if (requestKeyRef.current !== reqKey) return;

        cache.set(cacheKey, result, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        if (!append && !cursor) {
          await cacheSet(idbKey, result);
        }

        setProducts((prev) => (append ? [...prev, ...result.products] : result.products));
        cursorRef.current = result.nextCursor;
        setHasMore(!!result.hasMore);
        setError(result.products.length === 0 ? null : null);
      } catch (err: unknown) {
        if (requestKeyRef.current !== reqKey) return;
        setError(err instanceof Error ? err.message : 'فشل في تحميل المنتجات');
        if (!append) setProducts([]);
      } finally {
        if (requestKeyRef.current === reqKey) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [normalizedSlug, categoryFilter, searchFilter]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading || !cursorRef.current) return;
    fetchPage(true, cursorRef.current);
  }, [hasMore, loadingMore, loading, fetchPage]);

  const refetch = useCallback(() => {
    cursorRef.current = null;
    cache.flushByPrefix(`tenant-products:${normalizedSlug}:`);
    void cacheDeleteByPrefix(`idb:tenant-products:${normalizedSlug}`);
    fetchPage(false, null, true);
  }, [normalizedSlug, fetchPage]);

  useEffect(() => {
    if (!enabled) return;
    cursorRef.current = null;
    let cancelled = false;

    const run = async () => {
      if (!categoryFilter && !searchFilter) {
        let cachedFirstPage = getStorefrontFirstPageFromCache(normalizedSlug);
        if (!cachedFirstPage) {
          await awaitStorefrontBundleReady(normalizedSlug, {
            limit: PAGE_SIZE,
            cursor: null,
            category: categoryFilter,
            search: searchFilter,
          });
          if (cancelled) return;
          cachedFirstPage = getStorefrontFirstPageFromCache(normalizedSlug);
        }

        if (!cachedFirstPage) {
          await ensureStorefrontPageBundle(normalizedSlug, { limit: PAGE_SIZE });
          if (cancelled) return;
          cachedFirstPage = getStorefrontFirstPageFromCache(normalizedSlug);
        }

        if (cachedFirstPage) {
          setProducts(cachedFirstPage.products);
          cursorRef.current = cachedFirstPage.nextCursor;
          setHasMore(!!cachedFirstPage.hasMore);
          setError(null);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
      }

      if (!cancelled) fetchPage(false, null);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, normalizedSlug, categoryFilter, searchFilter, fetchPage]);

const PRODUCT_SCOPES: StorefrontInvalidationScope[] = ['full', 'products', 'product'];

  useEffect(() => {
    if (!enabled) return;

    const shouldRefetchProducts = (scope?: StorefrontInvalidationScope) =>
      !scope || PRODUCT_SCOPES.includes(scope);

    const onProductsChanged = (event: Event) => {
      const scope = (event as CustomEvent<{ scope?: StorefrontInvalidationScope }>).detail?.scope;
      if (!shouldRefetchProducts(scope)) return;
      refetch();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'storefront:invalidate' || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as { scope?: StorefrontInvalidationScope };
        if (!shouldRefetchProducts(payload.scope)) return;
      } catch {
        /* fall through to refetch */
      }
      refetch();
    };

    window.addEventListener(STOREFRONT_PRODUCTS_CHANGED, onProductsChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(STOREFRONT_PRODUCTS_CHANGED, onProductsChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled, refetch]);

  return {
    products,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refetch,
  };
};
