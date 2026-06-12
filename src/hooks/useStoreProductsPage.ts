import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, ColorOption, ProductVariant } from '@/types';
import { applyActiveDiscount } from '@/utils/inventoryUtils';
import { cache, CacheTTL, dedup } from '@/lib/cache';

const PAGE_SIZE = 24;

const formatStorefrontProduct = (p: Record<string, unknown>): Product =>
  applyActiveDiscount({
    id: String(p.id),
    name: String(p.name),
    description: String(p.description || ''),
    category: String(p.category || ''),
    price: Number(p.price),
    image: String(p.image_url || ''),
    additionalImages: (p.additional_images as string[]) || undefined,
    stockQuantity: p.stock_quantity != null ? Number(p.stock_quantity) : undefined,
    sizes: Array.isArray(p.sizes) ? (p.sizes as string[]) : undefined,
    colors: Array.isArray(p.colors) ? (p.colors as ColorOption[]) : undefined,
    variants: Array.isArray(p.variants) ? (p.variants as ProductVariant[]) : undefined,
    discountType: p.discount_type as Product['discountType'],
    discountValue: p.discount_value != null ? Number(p.discount_value) : undefined,
    discountStartDate: p.discount_start_date as string | undefined,
    discountEndDate: p.discount_end_date as string | undefined,
    originalPrice: p.original_price != null ? Number(p.original_price) : undefined,
  });

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
    async (append = false, cursor: string | null = null) => {
      if (!normalizedSlug || !/^[a-z0-9-]+$/.test(normalizedSlug)) {
        setLoading(false);
        setError('رابط المتجر غير صالح');
        return;
      }

      const reqKey = `${normalizedSlug}:${categoryFilter || ''}:${searchFilter || ''}:${cursor || 'start'}`;
      requestKeyRef.current = reqKey;

      if (append) setLoadingMore(true);
      else setLoading(true);

      const cacheKey = `tenant-products:${reqKey}`;

      try {
        const result = await dedup(cacheKey, async () => {
          const { data, error: rpcError } = await (supabase as any).rpc('get_store_products_page', {
            p_slug: normalizedSlug,
            p_limit: PAGE_SIZE,
            p_cursor: cursor,
            p_category: categoryFilter || null,
            p_search: searchFilter || null,
          });

          if (rpcError) throw rpcError;
          return data as {
            products: Record<string, unknown>[];
            next_cursor: string | null;
            has_more: boolean;
          };
        });

        if (requestKeyRef.current !== reqKey) return;

        const mapped = (result.products || []).map(formatStorefrontProduct);
        cache.set(cacheKey, result, CacheTTL.SHORT, CacheTTL.STALE);

        setProducts((prev) => (append ? [...prev, ...mapped] : mapped));
        cursorRef.current = result.next_cursor || null;
        setHasMore(!!result.has_more);
        setError(null);
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
    fetchPage(false, null);
  }, [normalizedSlug, fetchPage]);

  useEffect(() => {
    if (!enabled) return;
    cursorRef.current = null;
    fetchPage(false, null);
  }, [enabled, fetchPage]);

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
