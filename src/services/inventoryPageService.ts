/**
 * Inventory / Products hub — one coordinated load for initial page render.
 */
import { Category, Product } from '@/types';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import {
  getCategories,
  getCategoriesSync,
  loadProductsPage,
  PRODUCTS_PAGE_SIZE,
} from '@/services/productService';
import {
  fetchMerchantInventorySummary,
  type MerchantInventorySummary,
} from '@/services/inventoryService';
import { countPendingReviewsForOwner } from '@/services/reviewService';
import type { ProductCatalogStats } from '@/utils/productCatalogPageUtils';
import { computeProductCatalogStats } from '@/utils/productCatalogPageUtils';

export type InventoryPageBundle = {
  categories: Category[];
  products: Product[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  summary: MerchantInventorySummary | null;
  pendingReviewsCount: number;
};

export function catalogStatsFromInventorySummary(
  summary: MerchantInventorySummary
): ProductCatalogStats {
  const inStock = Math.max(0, summary.published - summary.lowStock - summary.outOfStock);
  return {
    total: summary.totalProducts,
    published: summary.published,
    drafts: summary.draft,
    archived: summary.archived,
    inStock,
    lowStock: summary.lowStock,
    outOfStock: summary.outOfStock,
    inventoryValue: summary.retailValue,
  };
}

/** Sync read when inventory bundle already warmed cache. */
export function peekInventoryPageBundle(ownerId: string): InventoryPageBundle | null {
  return cache.get<InventoryPageBundle>(CacheKeys.inventoryPage(ownerId));
}

export function invalidateInventoryPageBundle(ownerId: string): void {
  cache.del(CacheKeys.inventoryPage(ownerId));
  clearInflight(CacheKeys.inventoryPage(ownerId));
}

/** Single deduped entry for /products initial inventory data. */
export async function loadInventoryPageBundle(
  ownerId: string,
  options?: { force?: boolean }
): Promise<InventoryPageBundle> {
  const key = CacheKeys.inventoryPage(ownerId);

  if (!options?.force) {
    const peek = peekInventoryPageBundle(ownerId);
    if (peek) return peek;
  } else {
    invalidateInventoryPageBundle(ownerId);
  }

  return dedup(key, async () => {
    const categoriesFromCache = getCategoriesSync();
    const [categories, page, summary, pendingReviewsCount] = await Promise.all([
      categoriesFromCache.length > 0
        ? Promise.resolve(categoriesFromCache)
        : getCategories(options?.force ?? false),
      loadProductsPage(0, PRODUCTS_PAGE_SIZE, options?.force, undefined, undefined, 'inventory'),
      fetchMerchantInventorySummary(ownerId).catch(() => null),
      countPendingReviewsForOwner(ownerId).catch(() => 0),
    ]);

    const bundle: InventoryPageBundle = {
      categories,
      products: page.products,
      total: page.total,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor ?? null,
      summary,
      pendingReviewsCount,
    };

    cache.set(key, bundle, CacheTTL.MEDIUM, CacheTTL.STALE);
    return bundle;
  });
}

export function resolveInventoryPageStats(
  bundle: InventoryPageBundle | null,
  products: Product[]
): ProductCatalogStats {
  if (bundle?.summary) {
    return catalogStatsFromInventorySummary(bundle.summary);
  }
  return computeProductCatalogStats(products);
}
