/**
 * Centralized storefront cache keys, SWR helpers, and selective in-place patches.
 * Reduces full catalog invalidation on stock-only updates.
 */
import { Product } from '@/types';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { mapDbProduct } from '@/mappers/productMapper';
import type { StorefrontBundleCache, StorefrontProductsPage } from '@/types/storefrontCache';

export type { StorefrontBundleCache, StorefrontProductsPage } from '@/types/storefrontCache';

export const StorefrontCacheKeys = {
  bundle: (slug: string) => `storefront-bundle:${slug.trim().toLowerCase()}`,
  version: (slug: string) => `storefront-version:${slug.trim().toLowerCase()}`,
  page: (slug: string, cursor: string, category: string, search: string, limit: number) =>
    `storefront-page:${slug.trim().toLowerCase()}:${cursor}:${category}:${search}:${limit}`,
  edgeBundle: (slug: string, cursor: string, category: string, search: string, version?: number) =>
    `edge-bundle:${slug.trim().toLowerCase()}:v${version ?? 0}:${cursor}:${category}:${search}`,
  edgePage: (slug: string, cursor: string, category: string, search: string, version?: number) =>
    `edge-page:${slug.trim().toLowerCase()}:v${version ?? 0}:${cursor}:${category}:${search}`,
  edgeMeta: (slug: string, version?: number) =>
    `edge-meta:${slug.trim().toLowerCase()}:v${version ?? 0}`,
  meta: (slug: string) => CacheKeys.tenantMeta(slug.trim().toLowerCase()),
  product: (slug: string, productId: string) =>
    CacheKeys.storefrontProduct(slug.trim().toLowerCase(), productId),
  footer: (slug: string) => CacheKeys.footerSuggested(slug.trim().toLowerCase()),
} as const;

export function getStorefrontCached<T>(key: string, revalidate?: () => Promise<T>): T | null {
  return cache.get<T>(key, revalidate);
}

export function setStorefrontCached<T>(key: string, data: T): void {
  cache.set(key, data, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
}

export function rememberStorefrontCacheVersion(slug: string, version: number | undefined): void {
  if (!slug || version == null || Number.isNaN(version)) return;
  cache.set(StorefrontCacheKeys.version(slug), version, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
}

export function getRememberedStorefrontCacheVersion(slug: string): number | null {
  return cache.get<number>(StorefrontCacheKeys.version(slug));
}

const patchProductsInPage = (
  page: StorefrontProductsPage,
  productId: string,
  patch: Partial<Product>
): StorefrontProductsPage | null => {
  let changed = false;
  const products = page.products.map((p) => {
    if (p.id !== productId) return p;
    changed = true;
    return { ...p, ...patch };
  });
  return changed ? { ...page, products } : null;
};

/** Patch in-memory storefront caches for a single product (stock/price visibility). */
export function patchStorefrontProductInCache(
  slug: string,
  productId: string,
  patch: Partial<Product>
): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || !productId) return false;

  let patched = false;

  const bundleKey = StorefrontCacheKeys.bundle(normalized);
  const bundle = cache.get<StorefrontBundleCache>(bundleKey);
  if (bundle?.products?.length) {
    const next = patchProductsInPage(
      { products: bundle.products, nextCursor: bundle.nextCursor ?? null, hasMore: !!bundle.hasMore },
      productId,
      patch
    );
    if (next) {
      cache.set(bundleKey, { ...bundle, products: next.products }, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
      patched = true;
    }
  }

  const productKey = StorefrontCacheKeys.product(normalized, productId);
  const cachedProduct = cache.get<Product>(productKey);
  if (cachedProduct) {
    cache.set(productKey, { ...cachedProduct, ...patch }, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
    patched = true;
  }

  for (const key of cache.stats().keys) {
    if (
      key.startsWith(`tenant-products:${normalized}:`) ||
      key.startsWith(`storefront-page:${normalized}:`)
    ) {
      const page = cache.get<StorefrontProductsPage>(key);
      if (!page?.products?.length) continue;
      const next = patchProductsInPage(page, productId, patch);
      if (next) {
        cache.set(key, next, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        patched = true;
      }
    }
  }

  return patched;
}

export async function patchStorefrontProductFromOwner(
  ownerId: string,
  productId: string,
  patch: Partial<Product>
): Promise<boolean> {
  const { resolveStoreSlugByOwnerId } = await import('./storefrontProductService');
  const slug = await resolveStoreSlugByOwnerId(ownerId);
  if (!slug) return false;
  return patchStorefrontProductInCache(slug, productId, patch);
}

export async function patchStorefrontProductFromDbRow(
  ownerId: string,
  row: Record<string, unknown>
): Promise<boolean> {
  const productId = String(row.id ?? '');
  if (!productId) return false;

  const mapped = mapDbProduct(row);
  return patchStorefrontProductFromOwner(ownerId, productId, {
    stockQuantity: mapped.stockQuantity,
    variants: mapped.variants,
    price: mapped.price,
    originalPrice: mapped.originalPrice,
    discountType: mapped.discountType,
    discountValue: mapped.discountValue,
    isActive: mapped.isActive,
    archivedAt: mapped.archivedAt,
  });
}
