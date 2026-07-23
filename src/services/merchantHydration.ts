/**
 * Central merchant data hydration — loads store data from Supabase after login.
 * Avoids redundant round-trips when get_owner_bootstrap already populated cache.
 */
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import type { Product } from '@/types';
import type { Category } from '@/types';
import {
  getCategories,
  loadProductsPage,
  setCurrentStore,
} from '@/services/productService';
import {
  fetchStoreByUserId,
  fetchStoreSettings,
  bootstrapOwnerStore,
  ensureMerchantStoreSlug,
} from '@/services/storeService';
import { fetchOrdersFiltered, ORDERS_PER_PAGE, type OrdersPageResult } from '@/services/orderService';
import { fetchDashboardStatisticsBatch } from '@/services/dashboardStatsService';
import { logger } from '@/lib/observability';
import { fetchPlatformHealth } from '@/services/platformHealthService';
import { DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';
import { serializeOrderFilters } from '@/utils/orderQueryBuilder';

export interface HydrationResult {
  userId: string;
  storeId: string | null;
  productsCount: number;
  categoriesCount: number;
  ordersCount: number;
  settingsLoaded: boolean;
}

const readCachedProducts = (userId: string): Product[] =>
  cache.get<Product[]>(CacheKeys.products(userId)) ?? [];

const readCachedCategories = (userId: string): Category[] =>
  cache.get<Category[]>(CacheKeys.categories(userId)) ?? [];

export const hydrateMerchantStore = async (
  userId: string,
  options?: { username?: string; storeName?: string }
): Promise<HydrationResult> => {
  logger.info('merchant.hydrate.start', { userId });

  void fetchPlatformHealth(false).then((health) => {
    if (!health.ok) {
      logger.warn('platform.health.deferred', {
        userId,
        message: health.message,
        missing: health.missing,
      });
    }
  });

  if (!cache.has(CacheKeys.dashboardBatch(userId))) {
    void fetchDashboardStatisticsBatch(userId).catch(() => undefined);
  }

  const bootstrap = await bootstrapOwnerStore(userId);

  void ensureMerchantStoreSlug(userId, {
    username: options?.username,
    storeName: options?.storeName,
  }).catch((error) => {
    logger.warn('store.slug.ensure_deferred_failed', { userId, error });
  });

  const needsStore = !cache.has(CacheKeys.store(userId));
  const needsSettings = !cache.has(CacheKeys.storeSettings(userId));
  const needsProducts = readCachedProducts(userId).length === 0;
  const needsCategories = readCachedCategories(userId).length === 0;
  const defaultOrdersKey = CacheKeys.ordersFiltered(
    userId,
    serializeOrderFilters(DEFAULT_ORDER_FILTERS),
    0,
    ''
  );
  const needsOrders = !cache.has(defaultOrdersKey);

  const [storeRecord, storeProfile, productsPage, categories, ordersPage] = await Promise.all([
    needsStore ? fetchStoreByUserId(userId) : Promise.resolve(cache.get(CacheKeys.store(userId)) ?? null),
    needsSettings ? fetchStoreSettings(userId) : Promise.resolve(null),
    needsProducts
      ? loadProductsPage(0, undefined, false)
      : Promise.resolve({
          products: readCachedProducts(userId),
          hasMore: (bootstrap?.productsLoaded ?? readCachedProducts(userId).length) >= 50,
          total: bootstrap?.productsLoaded ?? readCachedProducts(userId).length,
        }),
    needsCategories ? getCategories(false) : Promise.resolve(readCachedCategories(userId)),
    needsOrders
      ? fetchOrdersFiltered(userId, DEFAULT_ORDER_FILTERS, 0, ORDERS_PER_PAGE)
      : Promise.resolve(
          cache.get<OrdersPageResult>(defaultOrdersKey) ?? {
            orders: cache.get<import('@/types').Order[]>(CacheKeys.ordersRecent(userId)) ?? [],
            total: 0,
            page: 0,
            pageSize: ORDERS_PER_PAGE,
            totalPages: 1,
          }
        ),
  ]);

  if (storeRecord?.id) {
    setCurrentStore(storeRecord.id);
  } else if (bootstrap?.storeId) {
    setCurrentStore(bootstrap.storeId);
  }

  const orders = ordersPage.orders;
  if (orders.length > 0) {
    cache.set(CacheKeys.ordersRecent(userId), orders.slice(0, 5), CacheTTL.MEDIUM, CacheTTL.STALE);
  }

  const result: HydrationResult = {
    userId,
    storeId: storeRecord?.id ?? bootstrap?.storeId ?? null,
    productsCount: productsPage.products.length,
    categoriesCount: categories.length,
    ordersCount: ordersPage.total || orders.length,
    settingsLoaded: !!storeProfile || cache.has(CacheKeys.storeSettings(userId)),
  };

  logger.info('merchant.hydrate.complete', {
    ...result,
    bootstrapHit: !!bootstrap?.storeId,
    skippedFetches: {
      store: !needsStore,
      settings: !needsSettings,
      products: !needsProducts,
      categories: !needsCategories,
      orders: !needsOrders,
    },
  });
  return result;
};
