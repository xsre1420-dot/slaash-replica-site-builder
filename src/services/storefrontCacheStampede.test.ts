import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheTTL, dedup, peekInflight } from '@/lib/cache';
import { StorefrontCacheKeys } from '@/services/storefrontCacheService';
import { storefrontBundleRevalidateKey } from '@/lib/storefront/storefrontRpcConfig';

describe('cache stampede protection', () => {
  beforeEach(() => {
    cache.flushAll();
  });

  it('coalesces concurrent SWR revalidations for the same cache key', async () => {
    let refreshes = 0;
    const key = StorefrontCacheKeys.bundleRequest('demo', {});
    const revalidateKey = storefrontBundleRevalidateKey('demo', {});

    cache.set(key, { store: { store_name: 'Demo' }, products: [] }, 1, 5_000);

    await new Promise((r) => setTimeout(r, 5));

    const revalidate = async () => {
      refreshes += 1;
      await new Promise((r) => setTimeout(r, 30));
      return { store: { store_name: 'Fresh' }, products: [] };
    };

    const [a, b, c] = [
      cache.get(key, revalidate, { revalidateDedupKey: revalidateKey }),
      cache.get(key, revalidate, { revalidateDedupKey: revalidateKey }),
      cache.get(key, revalidate, { revalidateDedupKey: revalidateKey }),
    ];

    expect(a?.store?.store_name).toBe('Demo');
    expect(b?.store?.store_name).toBe('Demo');
    expect(c?.store?.store_name).toBe('Demo');

    await peekInflight(revalidateKey);
    await new Promise((r) => setTimeout(r, 80));
    expect(refreshes).toBe(1);
  });

  it('serves last stale value while a refresh is in flight after full expiry', async () => {
    const key = StorefrontCacheKeys.bundleRequest('demo', {});
    const revalidateKey = storefrontBundleRevalidateKey('demo', {});

    cache.set(key, { store: { store_name: 'Stale' }, products: [] }, 1, 1);

    await new Promise((r) => setTimeout(r, 5));

    let refreshStarted = false;
    const refreshPromise = dedup(revalidateKey, async () => {
      refreshStarted = true;
      await new Promise((r) => setTimeout(r, 40));
      return { store: { store_name: 'Fresh' }, products: [] };
    });

    await Promise.resolve();

    const duringRefresh = cache.get(
      key,
      async () => refreshPromise,
      { revalidateDedupKey: revalidateKey }
    );

    expect(peekInflight(revalidateKey)).toBeDefined();
    expect(refreshStarted).toBe(true);
    expect(duringRefresh?.store?.store_name).toBe('Stale');

    await refreshPromise;
  });
});
