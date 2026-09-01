/**
 * Add Product page bundle — one coordinated load for initial form render.
 * Reuses merchant bootstrap cache (settings + categories + product count).
 */
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import type { Category } from '@/types';
import type { DeliveryPrice } from '@/utils/deliveryUtils';
import { getCategories, getCategoriesSync } from '@/services/productService';
import {
  bootstrapOwnerStore,
  fetchStoreSettings,
  mapStoreSettingsRow,
} from '@/services/storeService';

export type AddProductPageBundle = {
  categories: Category[];
  deliveryPrices: DeliveryPrice[];
  productCount: number;
};

function deliveryPricesFromSettings(settings: Record<string, unknown> | null | undefined): DeliveryPrice[] {
  if (!settings) return [];
  return mapStoreSettingsRow(settings).settings.deliveryPrices;
}

function readProductCount(ownerId: string): number | null {
  const fromBootstrap = cache.get<number>(CacheKeys.merchantProductCount(ownerId));
  if (typeof fromBootstrap === 'number' && !Number.isNaN(fromBootstrap)) {
    return fromBootstrap;
  }
  return null;
}

/** Sync read when merchant hydration already warmed cache. */
export function peekAddProductPageBundle(ownerId: string): AddProductPageBundle | null {
  const categories = cache.get<Category[]>(CacheKeys.categories(ownerId));
  const settings = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(ownerId));
  const productCount = readProductCount(ownerId);
  if (!categories || !settings || productCount === null) return null;
  return {
    categories,
    deliveryPrices: deliveryPricesFromSettings(settings),
    productCount,
  };
}

export function incrementMerchantProductCount(ownerId: string, delta = 1): void {
  const current = readProductCount(ownerId) ?? 0;
  cache.set(CacheKeys.merchantProductCount(ownerId), Math.max(0, current + delta), CacheTTL.MEDIUM, CacheTTL.STALE);
  clearInflight(CacheKeys.addProductPage(ownerId));
}

async function resolveBundleFromCaches(ownerId: string): Promise<AddProductPageBundle | null> {
  const peek = peekAddProductPageBundle(ownerId);
  if (peek) return peek;

  let categories = cache.get<Category[]>(CacheKeys.categories(ownerId));
  let settings = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(ownerId));
  let productCount = readProductCount(ownerId);

  if (categories == null || !settings || productCount === null) {
    await bootstrapOwnerStore(ownerId);
    categories = cache.get<Category[]>(CacheKeys.categories(ownerId)) ?? categories;
    settings = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(ownerId)) ?? settings;
    productCount = readProductCount(ownerId);
  }

  if (!settings) {
    await fetchStoreSettings(ownerId);
    settings = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(ownerId));
  }

  if (categories == null) {
    categories = await getCategories(false);
  }

  if (productCount === null) {
    productCount = 0;
    cache.set(CacheKeys.merchantProductCount(ownerId), 0, CacheTTL.MEDIUM, CacheTTL.STALE);
  }

  if (!settings) {
    return null;
  }

  return {
    categories: categories ?? [],
    deliveryPrices: deliveryPricesFromSettings(settings),
    productCount,
  };
}

/** Single entry point for Add Product initial data — deduped per owner. */
export async function loadAddProductPageBundle(ownerId: string): Promise<AddProductPageBundle> {
  const key = CacheKeys.addProductPage(ownerId);
  return dedup(key, async () => {
    const resolved = await resolveBundleFromCaches(ownerId);
    if (resolved) return resolved;

    const categories = getCategoriesSync().length > 0 ? getCategoriesSync() : await getCategories(false);
    const profile = await fetchStoreSettings(ownerId);
    const settings = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(ownerId));
    const productCount = readProductCount(ownerId) ?? 0;

    return {
      categories,
      deliveryPrices: profile?.settings.deliveryPrices ?? deliveryPricesFromSettings(settings),
      productCount,
    };
  });
}

/** After category CRUD from the form dialog — refresh categories only. */
export async function refreshAddProductPageCategories(ownerId: string): Promise<Category[]> {
  clearInflight(CacheKeys.addProductPage(ownerId));
  cache.del(CacheKeys.categories(ownerId));
  return getCategories(true);
}
