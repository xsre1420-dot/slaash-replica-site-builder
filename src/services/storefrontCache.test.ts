import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheKeys } from '@/lib/cache';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

vi.mock('@/services/storefrontEdgeService', () => ({
  fetchStorefrontBundleViaEdge: vi.fn().mockResolvedValue(null),
  fetchStorefrontPageViaEdge: vi.fn().mockResolvedValue(null),
  requestEdgeStorefrontPurge: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/utils/indexedDB', () => ({
  cacheDeleteByPrefix: vi.fn().mockResolvedValue(undefined),
}));

import {
  resolveStoreSlugByOwnerId,
  resolveStoreOwnerBySlug,
  invalidateStorefrontForOwner,
} from './storefrontProductService';
import {
  patchStorefrontProductInCache,
  StorefrontCacheKeys,
} from './storefrontCacheService';

describe('storefront slug resolution cache', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'store_settings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { store_slug: 'my-store' },
                error: null,
              }),
            })),
            ilike: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { owner_id: 'owner-1' },
                error: null,
              }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };
    });
    mockRpc.mockResolvedValue({
      data: { store: { owner_id: 'owner-1' } },
      error: null,
    });
  });

  it('caches resolveStoreSlugByOwnerId and avoids repeat DB reads', async () => {
    const first = await resolveStoreSlugByOwnerId('owner-1');
    const second = await resolveStoreSlugByOwnerId('owner-1');

    expect(first).toBe('my-store');
    expect(second).toBe('my-store');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(cache.get(CacheKeys.ownerSlug('owner-1'))).toBe('my-store');
  });

  it('caches resolveStoreOwnerBySlug via store_settings fallback', async () => {
    const first = await resolveStoreOwnerBySlug('my-store');
    const second = await resolveStoreOwnerBySlug('my-store');

    expect(first).toBe('owner-1');
    expect(second).toBe('owner-1');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(cache.get(CacheKeys.slugOwner('my-store'))).toBe('owner-1');
  });

  it('invalidateStorefrontForOwner clears slug resolution and bundle keys', async () => {
    await resolveStoreSlugByOwnerId('owner-1');
    await resolveStoreOwnerBySlug('my-store');
    cache.set('storefront-bundle:my-store', { store: {} }, 120_000, 60_000);
    cache.set(CacheKeys.footerSuggested('my-store'), [], 120_000, 60_000);

    await invalidateStorefrontForOwner('owner-1');

    expect(cache.get(CacheKeys.ownerSlug('owner-1'))).toBeNull();
    expect(cache.get(CacheKeys.slugOwner('my-store'))).toBeNull();
    expect(cache.get('storefront-bundle:my-store')).toBeNull();
    expect(cache.get(CacheKeys.footerSuggested('my-store'))).toBeNull();
  });

  it('patchStorefrontProductInCache updates bundle and product detail without full flush', () => {
    cache.set(
      StorefrontCacheKeys.bundle('my-store'),
      {
        store: { owner_id: 'owner-1' },
        products: [{ id: 'p1', name: 'A', price: 10, stockQuantity: 5 } as any],
        nextCursor: null,
        hasMore: false,
      },
      120_000,
      60_000
    );
    cache.set(
      StorefrontCacheKeys.product('my-store', 'p1'),
      { id: 'p1', name: 'A', price: 10, stockQuantity: 5 } as any,
      120_000,
      60_000
    );

    const patched = patchStorefrontProductInCache('my-store', 'p1', { stockQuantity: 0 });
    expect(patched).toBe(true);

    const bundle = cache.get<any>(StorefrontCacheKeys.bundle('my-store'));
    expect(bundle?.products?.[0]?.stockQuantity).toBe(0);
    expect(cache.get<any>(StorefrontCacheKeys.product('my-store', 'p1'))?.stockQuantity).toBe(0);
  });
});
