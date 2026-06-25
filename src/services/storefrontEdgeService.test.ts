import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '@/lib/cache';
import { StorefrontCacheKeys } from '@/services/storefrontCacheService';

vi.mock('@/lib/env', () => ({
  env: { VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key', VITE_SUPABASE_URL: 'https://test.supabase.co' },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import {
  fetchStorefrontMetaViaEdge,
  requestEdgeStorefrontPurge,
  resolveStorefrontEdgeUrl,
} from './storefrontEdgeService';

describe('storefrontEdgeService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('resolveStorefrontEdgeUrl uses Supabase functions path', () => {
    const url = resolveStorefrontEdgeUrl();
    expect(url).toMatch(/\/functions\/v1\/get-store-products$/);
  });

  it('fetchStorefrontMetaViaEdge caches meta with version', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        storeInfo: { store_name: 'Test' },
        categories: [],
        cache_version: 3,
      }),
    });

    const first = await fetchStorefrontMetaViaEdge('my-store');
    const second = await fetchStorefrontMetaViaEdge('my-store');

    expect(first?.storeInfo?.store_name).toBe('Test');
    expect(first?.cacheVersion).toBe(3);
    expect(second?.cacheVersion).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.get(StorefrontCacheKeys.version('my-store'))).toBe(3);
  });

  it('requestEdgeStorefrontPurge posts purge flag', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const ok = await requestEdgeStorefrontPurge('my-store');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('get-store-products'),
      expect.objectContaining({
        body: expect.stringContaining('"purge":true'),
      })
    );
  });
});
