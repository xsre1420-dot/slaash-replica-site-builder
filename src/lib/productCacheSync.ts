/**
 * Invalidate merchant product + storefront caches after CRUD mutations.
 */
import { cache, CacheKeys, clearInflight } from '@/lib/cache';
import { invalidateStorefrontForOwner } from '@/services/storefrontProductService';

export const syncProductCachesAfterMutation = (ownerId: string): void => {
  cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
  clearInflight(`${CacheKeys.products(ownerId)}:p0:s:c`);
  cache.del(CacheKeys.products(ownerId));
  cache.flushByPrefix(`stats:${ownerId}:`);
  void invalidateStorefrontForOwner(ownerId);
};
