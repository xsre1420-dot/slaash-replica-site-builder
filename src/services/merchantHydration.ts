/**
 * Central merchant data hydration — loads ALL store data from Supabase after login.
 * Single source of truth: database. In-memory cache is repopulated here.
 */
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import type { Product } from '@/types';
import {
  getCategories,
  loadProductsPage,
  setCurrentStore,
} from '@/services/productService';
import {
  fetchStoreByUserId,
  fetchStoreSettings,
  bootstrapOwnerStore,
} from '@/services/storeService';
import { fetchOrdersFiltered, ORDERS_PER_PAGE } from '@/services/orderService';
import { logger } from '@/lib/observability';
import { fetchPlatformHealth } from '@/services/platformHealthService';
import { DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';

export interface HydrationResult {
  userId: string;
  storeId: string | null;
  productsCount: number;
  categoriesCount: number;
  ordersCount: number;
  settingsLoaded: boolean;
}

export const hydrateMerchantStore = async (userId: string): Promise<HydrationResult> => {
  logger.info('merchant.hydrate.start', { userId });

  // Non-blocking — do not extend cold-start critical path
  void fetchPlatformHealth(false).then((health) => {
    if (!health.ok) {
      logger.warn('platform.health.deferred', {
        userId,
        message: health.message,
        missing: health.missing,
      });
    }
  });

  // Try combined RPC first (populates cache when migration applied)
  const bootstrap = await bootstrapOwnerStore(userId);
  const hasBootstrapSettings = cache.has(CacheKeys.storeSettings(userId));

  const [storeRecord, storeProfile, productsPage, categories, ordersPage] = await Promise.all([
    fetchStoreByUserId(userId),
    fetchStoreSettings(userId, !hasBootstrapSettings),
    bootstrap?.storeId
      ? Promise.resolve({
          products: cache.get<Product[]>(CacheKeys.products(userId)) || [],
          hasMore: (bootstrap.productsLoaded ?? 0) >= 50,
          total: bootstrap.productsLoaded ?? 0,
        })
      : loadProductsPage(0, undefined, true),
    getCategories(true),
    fetchOrdersFiltered(userId, DEFAULT_ORDER_FILTERS, 0, ORDERS_PER_PAGE),
  ]);

  if (storeRecord?.id) {
    setCurrentStore(storeRecord.id);
  }

  const orders = ordersPage.orders;
  if (orders.length > 0) {
    cache.set(CacheKeys.ordersRecent(userId), orders.slice(0, 5), CacheTTL.MEDIUM, CacheTTL.STALE);
  }

  const result: HydrationResult = {
    userId,
    storeId: storeRecord?.id ?? null,
    productsCount: productsPage.products.length,
    categoriesCount: categories.length,
    ordersCount: ordersPage.total || orders.length,
    settingsLoaded: !!storeProfile,
  };

  logger.info('merchant.hydrate.complete', result);
  return result;
};
