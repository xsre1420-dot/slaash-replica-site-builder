/**
 * Central merchant data hydration — loads ALL store data from Supabase after login.
 * Single source of truth: database. In-memory cache is repopulated here.
 */
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import {
  getCategories,
  loadAllMerchantProducts,
  setCurrentStore,
} from '@/services/productService';
import {
  fetchStoreByUserId,
  fetchStoreSettings,
  bootstrapOwnerStore,
} from '@/services/storeService';
import { fetchOrdersPage, ORDERS_PER_PAGE } from '@/services/orderService';
import { logger } from '@/lib/observability';
import { fetchPlatformHealth, invalidatePlatformHealthCache } from '@/services/platformHealthService';

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

  invalidatePlatformHealthCache();
  const health = await fetchPlatformHealth(true);
  if (!health.ok) {
    logger.warn('platform.health.degraded', {
      userId,
      message: health.message,
      missing: health.missing,
    });
  }

  // Try combined RPC first (populates cache when migration applied)
  await bootstrapOwnerStore(userId);

  const [storeRecord, storeProfile, productsPage, categories, orders] = await Promise.all([
    fetchStoreByUserId(userId),
    fetchStoreSettings(userId, true),
    loadAllMerchantProducts(true),
    getCategories(true),
    fetchOrdersPage(userId, 0, ORDERS_PER_PAGE),
  ]);

  if (storeRecord?.id) {
    setCurrentStore(storeRecord.id);
  }

  cache.set(CacheKeys.orders(userId, 0), orders, CacheTTL.MEDIUM, CacheTTL.STALE);

  const result: HydrationResult = {
    userId,
    storeId: storeRecord?.id ?? null,
    productsCount: productsPage.products.length,
    categoriesCount: categories.length,
    ordersCount: orders.length,
    settingsLoaded: !!storeProfile,
  };

  logger.info('merchant.hydrate.complete', result);
  return result;
};
