import { beforeEach, describe, expect, it } from 'vitest';
import { cache, CacheTTL } from '@/lib/cache';
import { StorefrontCacheKeys } from '@/services/storefrontCacheService';
import {
  getStorefrontFirstPageFromCache,
  peekStorefrontBundle,
} from '@/services/storefrontProductService';

describe('storefront load optimizer', () => {
  beforeEach(() => {
    cache.flushAll();
  });

  it('getStorefrontFirstPageFromCache returns null when bundle missing', () => {
    expect(getStorefrontFirstPageFromCache('demo')).toBeNull();
  });

  it('getStorefrontFirstPageFromCache returns products from warmed bundle', () => {
    const bundle = {
      store: { owner_id: 'o1', store_name: 'Demo' },
      categories: [],
      products: [{ id: 'p1', name: 'Item', price: 10 } as any],
      nextCursor: 'cursor-1',
      hasMore: true,
    };
    cache.set(
      StorefrontCacheKeys.bundleRequest('demo', {}),
      bundle,
      CacheTTL.STOREFRONT,
      CacheTTL.STOREFRONT_STALE
    );

    const page = getStorefrontFirstPageFromCache('demo');
    expect(page?.products).toHaveLength(1);
    expect(page?.nextCursor).toBe('cursor-1');
    expect(page?.hasMore).toBe(true);
    expect(peekStorefrontBundle('demo')?.store).toBeTruthy();
  });
});
