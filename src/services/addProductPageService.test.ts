import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import {
  loadAddProductPageBundle,
  peekAddProductPageBundle,
} from '@/services/addProductPageService';

vi.mock('@/services/storeService', () => ({
  bootstrapOwnerStore: vi.fn().mockResolvedValue({
    storeId: 'store-1',
    productsLoaded: 2,
    categoriesLoaded: 1,
  }),
  fetchStoreSettings: vi.fn(),
  mapStoreSettingsRow: (data: Record<string, unknown>) => ({
    storeName: 'Shop',
    storeLogo: '',
    storeGovernorate: '',
    settings: {
      deliveryPrices: [{ governorate: 'بغداد', price: 5000 }],
    },
  }),
}));

vi.mock('@/services/productService', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Electronics', order: 0 }]),
  getCategoriesSync: vi.fn().mockReturnValue([]),
}));

describe('addProductPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekAddProductPageBundle returns null when cache is cold', () => {
    expect(peekAddProductPageBundle('owner-1')).toBeNull();
  });

  it('peekAddProductPageBundle reads warmed merchant cache', () => {
    cache.set(CacheKeys.categories('owner-1'), [{ id: 'c1', name: 'A', order: 0 }], CacheTTL.MEDIUM, CacheTTL.STALE);
    cache.set(
      CacheKeys.storeSettings('owner-1'),
      { delivery_prices: [{ governorate: 'بغداد', price: 5000 }] },
      CacheTTL.MEDIUM,
      CacheTTL.STALE
    );
    cache.set(CacheKeys.merchantProductCount('owner-1'), 0, CacheTTL.MEDIUM, CacheTTL.STALE);

    const bundle = peekAddProductPageBundle('owner-1');
    expect(bundle?.categories).toHaveLength(1);
    expect(bundle?.productCount).toBe(0);
    expect(bundle?.deliveryPrices).toHaveLength(1);
  });

  it('loadAddProductPageBundle dedupes concurrent loads', async () => {
    cache.set(CacheKeys.categories('owner-1'), [{ id: 'c1', name: 'A', order: 0 }], CacheTTL.MEDIUM, CacheTTL.STALE);
    cache.set(
      CacheKeys.storeSettings('owner-1'),
      { delivery_prices: [{ governorate: 'بغداد', price: 5000 }] },
      CacheTTL.MEDIUM,
      CacheTTL.STALE
    );
    cache.set(CacheKeys.merchantProductCount('owner-1'), 3, CacheTTL.MEDIUM, CacheTTL.STALE);

    const [a, b] = await Promise.all([
      loadAddProductPageBundle('owner-1'),
      loadAddProductPageBundle('owner-1'),
    ]);

    expect(a.productCount).toBe(3);
    expect(b.categories).toEqual(a.categories);
  });

  it('loadAddProductPageBundle treats empty categories as cached (no extra category fetch)', async () => {
    const { bootstrapOwnerStore } = await import('@/services/storeService');
    const { getCategories } = await import('@/services/productService');

    cache.set(CacheKeys.categories('owner-1'), [], CacheTTL.MEDIUM, CacheTTL.STALE);
    cache.set(
      CacheKeys.storeSettings('owner-1'),
      { delivery_prices: [{ governorate: 'بغداد', price: 5000 }] },
      CacheTTL.MEDIUM,
      CacheTTL.STALE
    );
    cache.set(CacheKeys.merchantProductCount('owner-1'), 0, CacheTTL.MEDIUM, CacheTTL.STALE);

    const bundle = await loadAddProductPageBundle('owner-1');

    expect(bundle.categories).toEqual([]);
    expect(bootstrapOwnerStore).not.toHaveBeenCalled();
    expect(getCategories).not.toHaveBeenCalled();
  });
});
