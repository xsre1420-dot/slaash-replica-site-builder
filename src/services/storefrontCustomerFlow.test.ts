import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { Product } from '@/types';
import * as storefrontProductService from '@/services/storefrontProductService';
import {
  peekCheckoutInitBundle,
} from '@/lib/tenantStoreRegistry';
import { setStorefrontBundleInCache } from '@/services/storefrontCacheService';

const listProduct: Product = {
  id: 'p1',
  name: 'Test',
  price: 1000,
  category: 'Cat',
  description: 'Desc',
  image: 'https://example.com/a.jpg',
  stockQuantity: 5,
};

describe('storefrontCustomerFlow', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.restoreAllMocks();
  });

  it('findStorefrontListProduct reads from warmed bundle', () => {
    setStorefrontBundleInCache('demo', {}, {
      store: { store_name: 'Shop', owner_id: 'o1' },
      categories: [],
      products: [listProduct],
      nextCursor: null,
      hasMore: false,
    });

    expect(storefrontProductService.findStorefrontListProduct('demo', 'p1')?.name).toBe('Test');
    expect(storefrontProductService.peekStorefrontBundle('demo')?.products).toHaveLength(1);
  });

  it('loadProductDetailBundle reuses complete list product without blocking RPC', async () => {
    const fetchSpy = vi
      .spyOn(storefrontProductService, 'fetchStorefrontProductById')
      .mockResolvedValue(listProduct);

    setStorefrontBundleInCache('demo', {}, {
      store: { store_name: 'Shop', owner_id: 'o1' },
      categories: [],
      products: [listProduct],
      nextCursor: null,
      hasMore: false,
    });

    const detail = await storefrontProductService.loadProductDetailBundle('demo', 'p1');
    expect(detail?.id).toBe('p1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('peekCheckoutInitBundle reads checkout init cache', () => {
    cache.set(
      CacheKeys.checkoutInit('demo'),
      {
        ownerId: 'o1',
        storeName: 'Shop',
        storeSlug: 'demo',
        deliveryPrices: [{ governorate: 'بغداد', price: 5000 }],
        paymentMethods: ['cash_on_delivery'],
        whatsappNumber: '',
      },
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );

    expect(peekCheckoutInitBundle('demo')?.ownerId).toBe('o1');
  });

  it('ensureStorefrontPageBundle returns cached bundle without refetch', async () => {
    setStorefrontBundleInCache('demo', {}, {
      store: { store_name: 'Shop', owner_id: 'o1' },
      categories: [],
      products: [],
      nextCursor: null,
      hasMore: false,
    });

    const bundle = await storefrontProductService.ensureStorefrontPageBundle('demo');
    expect(bundle?.store?.store_name).toBe('Shop');
  });
});
