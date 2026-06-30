/**
 * Phase 5 — Scoped cache invalidation orchestrator.
 * Never flush-all unless explicitly requested; delegates to domain-specific flushers.
 */
import {
  cache,
  CacheKeys,
  flushOrderCache,
  flushOrderListCache,
  flushOwnerCache,
  flushSlugResolutionCache,
} from '@/lib/cache';
import {
  flushStorefrontProductCaches,
  flushStorefrontStoreCaches,
  flushStorefrontProductDetail,
  type StorefrontInvalidationScope,
} from '@/services/storefrontCacheTiers';
import { recordCacheInvalidation } from '@/lib/cache/cacheMonitoring';
import { distributedFlushPrefix, distributedInvalidate } from '@/lib/cache/distributedCache';

export type InvalidationScope =
  | 'storefront_full'
  | 'storefront_settings'
  | 'storefront_categories'
  | 'storefront_products'
  | 'storefront_product'
  | 'dashboard'
  | 'orders_list'
  | 'orders_all'
  | 'merchant_catalog'
  | 'merchant_full'
  | 'statistics'
  | 'marketing_public'
  | 'slug_resolution';

export type InvalidationTarget = {
  ownerId?: string;
  slug?: string;
  productId?: string;
};

export function invalidateDashboardCaches(ownerId: string): void {
  cache.del(CacheKeys.dashboardBatch(ownerId));
  cache.del(CacheKeys.dashboardKpisLight(ownerId));
  cache.del(CacheKeys.dashboardWorkflowCounts(ownerId));
  cache.flushByPrefix(`stats:${ownerId}:`);
  recordCacheInvalidation('dashboard', 4);
  void distributedFlushPrefix(`dash:${ownerId}`);
}

export function invalidateStatisticsCaches(ownerId: string): void {
  cache.flushByPrefix(`stats:${ownerId}:`);
  recordCacheInvalidation('analytics');
  void distributedFlushPrefix(`stats:${ownerId}`);
}

export function invalidateOrdersListCaches(ownerId: string): void {
  flushOrderListCache(ownerId);
  recordCacheInvalidation('orders');
}

export function invalidateOrdersAndDashboardCaches(ownerId: string): void {
  flushOrderCache(ownerId);
  recordCacheInvalidation('orders', 2);
  recordCacheInvalidation('dashboard', 3);
}

export function invalidateMerchantCatalogCaches(ownerId: string): void {
  cache.del(CacheKeys.products(ownerId));
  cache.del(CacheKeys.categories(ownerId));
  recordCacheInvalidation('merchant', 2);
}

export function invalidateMarketingPublicCache(slug: string): void {
  const normalized = slug.trim().toLowerCase();
  cache.flushByPrefix(`marketing:public:${normalized}`);
  recordCacheInvalidation('marketing');
  void distributedInvalidate(`marketing:public:${normalized}`);
}

export function invalidateStorefrontCachesScoped(
  slug: string,
  scope: StorefrontInvalidationScope,
  productId?: string
): void {
  const normalized = slug.trim().toLowerCase();
  switch (scope) {
    case 'settings':
    case 'categories':
      flushStorefrontStoreCaches(normalized);
      break;
    case 'products':
      flushStorefrontProductCaches(normalized);
      break;
    case 'product':
      if (productId) flushStorefrontProductDetail(normalized, productId);
      break;
    case 'full':
      flushStorefrontStoreCaches(normalized);
      flushStorefrontProductCaches(normalized);
      cache.del(CacheKeys.footerSuggested(normalized));
      break;
  }
  recordCacheInvalidation('storefront');
  void distributedFlushPrefix(`sf:${normalized}`);
}

export function invalidateByScope(scope: InvalidationScope, target: InvalidationTarget): void {
  const { ownerId, slug, productId } = target;

  switch (scope) {
    case 'dashboard':
      if (ownerId) invalidateDashboardCaches(ownerId);
      break;
    case 'statistics':
      if (ownerId) invalidateStatisticsCaches(ownerId);
      break;
    case 'orders_list':
      if (ownerId) invalidateOrdersListCaches(ownerId);
      break;
    case 'orders_all':
      if (ownerId) invalidateOrdersAndDashboardCaches(ownerId);
      break;
    case 'merchant_catalog':
      if (ownerId) invalidateMerchantCatalogCaches(ownerId);
      break;
    case 'merchant_full':
      if (ownerId) flushOwnerCache(ownerId);
      recordCacheInvalidation('merchant', 5);
      break;
    case 'marketing_public':
      if (slug) invalidateMarketingPublicCache(slug);
      break;
    case 'slug_resolution':
      if (ownerId) flushSlugResolutionCache(ownerId, slug);
      break;
    case 'storefront_full':
      if (slug) invalidateStorefrontCachesScoped(slug, 'full');
      break;
    case 'storefront_settings':
    case 'storefront_categories':
    case 'storefront_products':
      if (slug) {
        const map: Record<string, StorefrontInvalidationScope> = {
          storefront_settings: 'settings',
          storefront_categories: 'categories',
          storefront_products: 'products',
        };
        invalidateStorefrontCachesScoped(slug, map[scope] ?? 'full');
      }
      break;
    case 'storefront_product':
      if (slug && productId) invalidateStorefrontCachesScoped(slug, 'product', productId);
      break;
  }
}

export function buildVersionedKey(prefix: string, id: string, version: number): string {
  return `${prefix}${id}:v${version}`;
}
