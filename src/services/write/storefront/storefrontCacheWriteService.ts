/**
 * Storefront cache invalidation — write side effects only. No product/page reads.
 */
import { supabase } from '@/integrations/supabase/client';
import { cache, flushSlugResolutionCache } from '@/lib/cache';
import { cacheDeleteByPrefix } from '@/utils/indexedDB';
import {
  flushStorefrontProductCaches,
  flushStorefrontProductDetail,
  flushStorefrontStoreCaches,
  recordStorefrontScopedFlush,
  type StorefrontInvalidationScope,
} from '@/services/storefrontCacheTiers';
import { requestEdgeStorefrontPurge } from '@/services/storefrontEdgeService';
import { StorefrontCacheKeys } from '@/services/storefrontCacheService';
import { callWriteRpc } from '@/lib/readWrite/writeClient';
const STOREFRONT_PRODUCTS_CHANGED = 'storefront:products-changed';

export type { StorefrontInvalidationScope };

export async function bumpStorefrontCacheVersion(ownerId: string): Promise<number | null> {
  if (!ownerId) return null;
  try {
    const { data, error } = await callWriteRpc<number>('bump_storefront_cache_version', {
      p_owner_id: ownerId,
    });
    if (error) return null;
    return data != null ? Number(data) : null;
  } catch {
    return null;
  }
}

export async function invalidateStorefrontScope(
  ownerId: string,
  scope: StorefrontInvalidationScope,
  options?: { productId?: string; bumpVersion?: boolean }
): Promise<void> {
  recordStorefrontScopedFlush(scope);

  const { data } = await supabase
    .from('store_settings')
    .select('store_slug')
    .eq('owner_id', ownerId)
    .maybeSingle();

  let slug = data?.store_slug?.trim().toLowerCase();

  if (!slug) {
    try {
      const { data: storeRow } = await (supabase as any)
        .from('stores')
        .select('store_slug')
        .eq('user_id', ownerId)
        .maybeSingle();
      slug = storeRow?.store_slug?.trim().toLowerCase();
    } catch {
      /* stores table may not exist */
    }
  }

  if (scope === 'full') {
    flushSlugResolutionCache(ownerId, slug);
  }

  if (options?.bumpVersion) {
    await bumpStorefrontCacheVersion(ownerId);
  }

  if (slug) {
    switch (scope) {
      case 'settings':
      case 'categories':
        flushStorefrontStoreCaches(slug);
        void requestEdgeStorefrontPurge(slug);
        break;
      case 'products':
        flushStorefrontProductCaches(slug);
        cache.flushByPrefix(`edge-page:${slug}`);
        cache.flushByPrefix(`storefront-product:${slug}:`);
        await cacheDeleteByPrefix(`idb:tenant-products:${slug}`);
        void requestEdgeStorefrontPurge(slug);
        break;
      case 'product':
        if (options?.productId) {
          flushStorefrontProductDetail(slug, options.productId);
        }
        break;
      case 'full':
        cache.del(StorefrontCacheKeys.bundle(slug));
        cache.del(StorefrontCacheKeys.version(slug));
        cache.flushByPrefix(`tenant-products:${slug}`);
        cache.flushByPrefix(StorefrontCacheKeys.meta(slug));
        cache.flushByPrefix(`edge-bundle:${slug}`);
        cache.flushByPrefix(`edge-page:${slug}`);
        cache.flushByPrefix(`edge-meta:${slug}`);
        cache.flushByPrefix(`storefront-page:${slug}:`);
        cache.flushByPrefix(`storefront-product:${slug}:`);
        cache.del(StorefrontCacheKeys.footer(slug));
        await cacheDeleteByPrefix(`idb:tenant-products:${slug}`);
        await cacheDeleteByPrefix(`idb:tenant-meta:${slug}`);
        void requestEdgeStorefrontPurge(slug);
        break;
    }
  } else if (scope === 'full' || scope === 'products') {
    cache.flushByPrefix(`tenant-products:${ownerId}`);
    await cacheDeleteByPrefix(`idb:tenant-products:${ownerId}`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(STOREFRONT_PRODUCTS_CHANGED, {
        detail: { ownerId, slug, scope, productId: options?.productId },
      })
    );
    if (scope === 'full' || scope === 'products' || scope === 'settings' || scope === 'categories') {
      try {
        localStorage.setItem(
          'storefront:invalidate',
          JSON.stringify({ ownerId, slug, scope, at: Date.now() })
        );
      } catch {
        /* ignore quota */
      }
    }
  }
}

export async function invalidateStorefrontForOwner(
  ownerId: string,
  options?: { bumpVersion?: boolean }
): Promise<void> {
  return invalidateStorefrontScope(ownerId, 'full', options);
}
