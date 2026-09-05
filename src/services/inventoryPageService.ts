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
  mapMerchantInventorySummaryPayload,
  type MerchantInventorySummary,
} from '@/services/inventoryService';
import { countPendingReviewsForOwner } from '@/services/reviewService';
import type { ProductCatalogStats } from '@/utils/productCatalogPageUtils';
import { computeProductCatalogStats } from '@/utils/productCatalogPageUtils';
import { rpcGetMerchantInventoryPageBundle } from '@/repositories/inventory/inventoryRepository';
import { hasInventoryPageBundleRpc } from '@/lib/supabase/schemaCapabilities';
import { safeMapDbProduct } from '@/mappers/productMapper';

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

function mapBundleCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const cat = row as Record<string, unknown>;
    return {
      id: String(cat.id ?? ''),
      name: String(cat.name ?? ''),
      order: Number(cat.display_order ?? cat.order ?? 0),
    };
  });
}

async function tryLoadInventoryPageBundleRpc(
  ownerId: string,
  pageSize: number
): Promise<InventoryPageBundle | null> {
  if (!(await hasInventoryPageBundleRpc())) return null;

  const { data, error } = await rpcGetMerchantInventoryPageBundle(ownerId, pageSize);
  const payload = data as Record<string, unknown> | null;
  if (error || !payload?.success) return null;

  const products = ((payload.products as Record<string, unknown>[]) || [])
    .map((row) => safeMapDbProduct(row))
    .filter((p): p is Product => p != null);

  const categories = mapBundleCategories(payload.categories);
  if (categories.length > 0) {
    cache.set(CacheKeys.categories(ownerId), categories, CacheTTL.LONG, CacheTTL.STALE);
  }

  return {
    categories,
    products,
    total: Number(payload.total ?? products.length),
    hasMore: Boolean(payload.has_more),
    nextCursor: (payload.next_cursor as string | null) ?? null,
    summary: mapMerchantInventorySummaryPayload(payload.summary as Record<string, unknown>),
    pendingReviewsCount: Number(payload.pending_reviews_count ?? 0),
  };
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
    if (!options?.force) {
      const fromRpc = await tryLoadInventoryPageBundleRpc(ownerId, PRODUCTS_PAGE_SIZE).catch(() => null);
      if (fromRpc) {
        cache.set(key, fromRpc, CacheTTL.MEDIUM, CacheTTL.STALE);
        return fromRpc;
      }
    }

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
