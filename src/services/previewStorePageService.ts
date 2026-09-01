/**
 * Merchant preview store page — one coordinated load for /preview initial render.
 */
import type { Category, Product } from '@/types';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import {
  getCategories,
  getCategoriesSync,
  loadProductsPage,
  PRODUCTS_PAGE_SIZE,
} from '@/services/productService';
import { bootstrapOwnerStore } from '@/services/storeService';
import { resolveStoreSlugByOwnerId } from '@/services/storefrontProductService';

export type PreviewStorePageBundle = {
  categories: Category[];
  products: Product[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  storeSlug: string | null;
};

export function peekPreviewStorePageBundle(ownerId: string): PreviewStorePageBundle | null {
  return cache.get<PreviewStorePageBundle>(CacheKeys.previewStorePage(ownerId));
}

export function invalidatePreviewStorePageBundle(ownerId: string): void {
  cache.del(CacheKeys.previewStorePage(ownerId));
  clearInflight(CacheKeys.previewStorePage(ownerId));
}

/** Single deduped entry for merchant preview initial data. */
export async function loadPreviewStorePageBundle(
  ownerId: string,
  options?: { force?: boolean }
): Promise<PreviewStorePageBundle> {
  const key = CacheKeys.previewStorePage(ownerId);

  if (!options?.force) {
    const peek = peekPreviewStorePageBundle(ownerId);
    if (peek) return peek;
  } else {
    invalidatePreviewStorePageBundle(ownerId);
  }

  return dedup(key, async () => {
    if (!cache.has(CacheKeys.categories(ownerId)) || !cache.has(CacheKeys.storeSettings(ownerId))) {
      await bootstrapOwnerStore(ownerId);
    }

    const [categories, productsPage, storeSlug] = await Promise.all([
      getCategoriesSync().length > 0 ? Promise.resolve(getCategoriesSync()) : getCategories(false),
      loadProductsPage(0, PRODUCTS_PAGE_SIZE, options?.force ?? false, undefined, undefined, 'grid'),
      resolveStoreSlugByOwnerId(ownerId),
    ]);

    const bundle: PreviewStorePageBundle = {
      categories,
      products: productsPage.products,
      total: productsPage.total,
      hasMore: productsPage.hasMore,
      nextCursor: productsPage.nextCursor ?? null,
      storeSlug,
    };

    cache.set(key, bundle, CacheTTL.MEDIUM, CacheTTL.STALE);
    return bundle;
  });
}

export function previewCategoriesWithAll(categories: Category[]): Category[] {
  return [{ id: 'all', name: 'الكل', order: -1 }, ...categories];
}
