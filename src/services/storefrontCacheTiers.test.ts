import { beforeEach, describe, expect, it } from 'vitest';
import { cache, CacheTTL } from '@/lib/cache';
import {
  flushStorefrontProductCaches,
  flushStorefrontStoreCaches,
  getStorefrontCacheMetrics,
  patchStorefrontCategoriesInCache,
  patchStorefrontSettingsInCache,
  ProductCacheKeys,
  resetStorefrontCacheMetricsForTests,
  StoreCacheKeys,
} from './storefrontCacheTiers';

describe('storefrontCacheTiers', () => {
  beforeEach(() => {
    cache.flushAll();
    resetStorefrontCacheMetricsForTests();
  });

  it('patchStorefrontCategoriesInCache updates bundle and meta without touching products', () => {
    cache.set(
      StoreCacheKeys.bundle('demo'),
      {
        store: { store_name: 'Demo' },
        categories: [{ id: 'c1', name: 'Old', display_order: 0 }],
        products: [{ id: 'p1', name: 'Item' } as any],
      },
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );
    cache.set(
      StoreCacheKeys.meta('demo'),
      {
        storeInfo: { storeName: 'Demo' },
        categories: [{ id: 'c1', name: 'Old', order: 0 }],
      },
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );
    cache.set(
      ProductCacheKeys.tenantPage('demo', '', '', 'start'),
      { products: [{ id: 'p1' } as any], nextCursor: null, hasMore: false },
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );

    const patched = patchStorefrontCategoriesInCache('demo', [
      { id: 'c2', name: 'New', order: 1 },
    ]);

    expect(patched).toBe(true);
    expect(cache.get<any>(StoreCacheKeys.bundle('demo'))?.categories?.[0]?.name).toBe('New');
    expect(cache.get<any>(StoreCacheKeys.meta('demo'))?.categories?.[0]?.name).toBe('New');
    expect(cache.get(ProductCacheKeys.tenantPage('demo', '', '', 'start'))).toBeTruthy();
    expect(getStorefrontCacheMetrics().patches).toBe(1);
  });

  it('patchStorefrontSettingsInCache updates branding without flushing product lists', () => {
    cache.set(
      StoreCacheKeys.bundle('demo'),
      { store: { store_name: 'Old' }, products: [{ id: 'p1' } as any] },
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );
    cache.set(
      ProductCacheKeys.tenantPage('demo', '', '', 'start'),
      { products: [{ id: 'p1' } as any], nextCursor: null, hasMore: false },
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );

    patchStorefrontSettingsInCache('demo', { store_name: 'New Name' });

    expect(cache.get<any>(StoreCacheKeys.bundle('demo'))?.store?.store_name).toBe('New Name');
    expect(cache.get(ProductCacheKeys.tenantPage('demo', '', '', 'start'))).toBeTruthy();
  });

  it('flushStorefrontProductCaches preserves store meta', () => {
    cache.set(StoreCacheKeys.meta('demo'), { storeInfo: {} }, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
    cache.set(
      ProductCacheKeys.tenantPage('demo', '', '', 'start'),
      { products: [], nextCursor: null, hasMore: false },
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );

    flushStorefrontProductCaches('demo');

    expect(cache.get(StoreCacheKeys.meta('demo'))).toBeTruthy();
    expect(cache.get(ProductCacheKeys.tenantPage('demo', '', '', 'start'))).toBeNull();
  });

  it('flushStorefrontStoreCaches preserves product lists', () => {
    cache.set(StoreCacheKeys.bundle('demo'), { store: {} }, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
    cache.set(
      ProductCacheKeys.tenantPage('demo', '', '', 'start'),
      { products: [{ id: 'p1' } as any], nextCursor: null, hasMore: false },
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );

    flushStorefrontStoreCaches('demo');

    expect(cache.get(StoreCacheKeys.bundle('demo'))).toBeNull();
    expect(cache.get(ProductCacheKeys.tenantPage('demo', '', '', 'start'))).toBeTruthy();
  });
});
