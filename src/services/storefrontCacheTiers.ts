/**
 * Storefront cache tier registry — Store, Product, Category, Settings namespaces.
 * Tracks hit/miss metrics and documents TTL policy per data class.
 */
import { Product } from '@/types';
import { cache, CacheTTL } from '@/lib/cache';
import { cacheDeleteByPrefix } from '@/utils/indexedDB';
import type { StorefrontBundleCache, StorefrontProductsPage } from '@/types/storefrontCache';
import { StorefrontCacheKeys, setStorefrontCached } from '@/services/storefrontCacheService';

export type StorefrontDataClass = 'store' | 'product' | 'category' | 'settings';

export type StorefrontInvalidationScope = 'full' | 'settings' | 'categories' | 'products' | 'product';

/** Documented TTL policy per storefront data class. */
export const StorefrontCacheTTL = {
  store: { ttl: CacheTTL.STOREFRONT, stale: CacheTTL.STOREFRONT_STALE },
  product: { ttl: CacheTTL.STOREFRONT, stale: CacheTTL.STOREFRONT_STALE },
  category: { ttl: CacheTTL.STOREFRONT, stale: CacheTTL.STOREFRONT_STALE },
  settings: { ttl: CacheTTL.STOREFRONT, stale: CacheTTL.STOREFRONT_STALE },
  idbProducts: 5 * 60 * 1000,
  idbMeta: 10 * 60 * 1000,
} as const;

export const StoreCacheKeys = {
  bundle: (slug: string) => StorefrontCacheKeys.bundle(slug),
  meta: (slug: string) => StorefrontCacheKeys.meta(slug),
  version: (slug: string) => StorefrontCacheKeys.version(slug),
  footer: (slug: string) => StorefrontCacheKeys.footer(slug),
} as const;

export const ProductCacheKeys = {
  page: (slug: string, cursor: string, category: string, search: string, limit: number) =>
    StorefrontCacheKeys.page(slug, cursor, category, search, limit),
  tenantPage: (slug: string, category: string, search: string, cursor: string) =>
    `tenant-products:${slug.trim().toLowerCase()}:${category}:${search}:${cursor}`,
  detail: (slug: string, productId: string) => StorefrontCacheKeys.product(slug, productId),
  idbPage: (slug: string, category: string, search: string, cursor: string) =>
    `idb:${ProductCacheKeys.tenantPage(slug, category, search, cursor)}`,
} as const;

export const CategoryCacheKeys = {
  embeddedIn: (slug: string) => StoreCacheKeys.meta(slug),
} as const;

export const SettingsCacheKeys = {
  merchant: (ownerId: string) => `store_settings:${ownerId}`,
  publicMeta: (slug: string) => StoreCacheKeys.meta(slug),
} as const;

type CacheMetrics = {
  hits: Record<StorefrontDataClass, number>;
  misses: Record<StorefrontDataClass, number>;
  patches: number;
  scopedFlushes: Record<StorefrontInvalidationScope, number>;
};

const metrics: CacheMetrics = {
  hits: { store: 0, product: 0, category: 0, settings: 0 },
  misses: { store: 0, product: 0, category: 0, settings: 0 },
  patches: 0,
  scopedFlushes: { full: 0, settings: 0, categories: 0, products: 0, product: 0 },
};

export function recordStorefrontCacheHit(dataClass: StorefrontDataClass): void {
  metrics.hits[dataClass]++;
}

export function recordStorefrontCacheMiss(dataClass: StorefrontDataClass): void {
  metrics.misses[dataClass]++;
}

export function recordStorefrontCachePatch(): void {
  metrics.patches++;
}

export function recordStorefrontScopedFlush(scope: StorefrontInvalidationScope): void {
  metrics.scopedFlushes[scope]++;
}

export function getStorefrontCacheMetrics(): CacheMetrics & {
  hitRate: Record<StorefrontDataClass, number>;
} {
  const hitRate = {} as Record<StorefrontDataClass, number>;
  for (const key of ['store', 'product', 'category', 'settings'] as StorefrontDataClass[]) {
    const total = metrics.hits[key] + metrics.misses[key];
    hitRate[key] = total > 0 ? metrics.hits[key] / total : 0;
  }
  return { ...metrics, hitRate };
}

export function resetStorefrontCacheMetricsForTests(): void {
  metrics.hits = { store: 0, product: 0, category: 0, settings: 0 };
  metrics.misses = { store: 0, product: 0, category: 0, settings: 0 };
  metrics.patches = 0;
  metrics.scopedFlushes = { full: 0, settings: 0, categories: 0, products: 0, product: 0 };
}

export interface StorefrontCategoryRow {
  id: string;
  name: string;
  order: number;
}

/** Patch category nav in bundle + meta without clearing product lists. */
export function patchStorefrontCategoriesInCache(
  slug: string,
  categories: StorefrontCategoryRow[]
): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || !categories.length) return false;

  let patched = false;
  const dbShape = categories.map((c) => ({
    id: c.id,
    name: c.name,
    display_order: c.order,
  }));

  const bundleKey = StoreCacheKeys.bundle(normalized);
  const bundle = cache.get<StorefrontBundleCache>(bundleKey);
  if (bundle) {
    cache.set(
      bundleKey,
      { ...bundle, categories: dbShape },
      StorefrontCacheTTL.category.ttl,
      StorefrontCacheTTL.category.stale
    );
    patched = true;
  }

  const metaKey = StoreCacheKeys.meta(normalized);
  const meta = cache.get<{ storeInfo: Record<string, unknown>; categories: StorefrontCategoryRow[] }>(
    metaKey
  );
  if (meta) {
    cache.set(
      metaKey,
      { ...meta, categories },
      StorefrontCacheTTL.category.ttl,
      StorefrontCacheTTL.category.stale
    );
    patched = true;
  }

  if (patched) recordStorefrontCachePatch();
  return patched;
}

/** Patch public store branding/settings in bundle + meta without clearing products. */
export function patchStorefrontSettingsInCache(
  slug: string,
  storePatch: Record<string, unknown>
): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || !Object.keys(storePatch).length) return false;

  let patched = false;

  const bundleKey = StoreCacheKeys.bundle(normalized);
  const bundle = cache.get<StorefrontBundleCache>(bundleKey);
  if (bundle?.store) {
    cache.set(
      bundleKey,
      { ...bundle, store: { ...bundle.store, ...storePatch } },
      StorefrontCacheTTL.settings.ttl,
      StorefrontCacheTTL.settings.stale
    );
    patched = true;
  }

  const metaKey = StoreCacheKeys.meta(normalized);
  const meta = cache.get<{ storeInfo: Record<string, unknown>; categories: unknown[] }>(metaKey);
  if (meta?.storeInfo) {
    cache.set(
      metaKey,
      { ...meta, storeInfo: { ...meta.storeInfo, ...storePatch } },
      StorefrontCacheTTL.settings.ttl,
      StorefrontCacheTTL.settings.stale
    );
    patched = true;
  }

  if (patched) recordStorefrontCachePatch();
  return patched;
}

/** Flush product list caches only (preserve store meta). */
export function flushStorefrontProductCaches(slug: string): void {
  const normalized = slug.trim().toLowerCase();
  cache.flushByPrefix(`tenant-products:${normalized}:`);
  cache.flushByPrefix(`storefront-page:${normalized}:`);
  cache.flushByPrefix(`edge-page:${normalized}`);
}

/** Flush store/settings/meta caches only (preserve product lists). */
export function flushStorefrontStoreCaches(slug: string): void {
  const normalized = slug.trim().toLowerCase();
  cache.del(StoreCacheKeys.bundle(normalized));
  cache.del(StoreCacheKeys.meta(normalized));
  cache.del(StoreCacheKeys.version(normalized));
  cache.del(StoreCacheKeys.footer(normalized));
  cache.flushByPrefix(`edge-bundle:${normalized}`);
  cache.flushByPrefix(`edge-meta:${normalized}`);
  void cacheDeleteByPrefix(`idb:${StoreCacheKeys.meta(normalized)}`);
}

/** Invalidate a single product detail entry. */
export function flushStorefrontProductDetail(slug: string, productId: string): void {
  cache.del(ProductCacheKeys.detail(slug, productId));
}

export function getStorefrontCachedProduct<T>(
  slug: string,
  productId: string
): T | null {
  const hit = cache.get<T>(ProductCacheKeys.detail(slug, productId));
  if (hit) recordStorefrontCacheHit('product');
  else recordStorefrontCacheMiss('product');
  return hit;
}

export function setStorefrontCachedProduct(slug: string, productId: string, product: Product): void {
  setStorefrontCached(ProductCacheKeys.detail(slug, productId), product);
}

export function getStorefrontCachedPage<T>(
  slug: string,
  cursor: string,
  category: string,
  search: string,
  limit: number
): T | null {
  const hit = cache.get<T>(ProductCacheKeys.page(slug, cursor, category, search, limit));
  if (hit) recordStorefrontCacheHit('product');
  else recordStorefrontCacheMiss('product');
  return hit;
}
