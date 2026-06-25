/**
 * Canonical service layer exports.
 *
 * UI → Service → Database
 * Pages, components, and hooks should import from here (or domain service files), never from Supabase directly.
 */

/** Database RPC wrapper */
export * as Database from '@/services/database';

/** Authentication & profiles */
export * as AuthService from '@/services/authService';

/** Merchant catalog (re-exports legacy dummyData engine + CRUD) */
export * as ProductService from '@/services/productService';

/** Store settings & merchant store profile */
export * as StoreService from '@/services/storeService';

/** Orders & checkout */
export * as OrderService from '@/services/orderService';

/** Inventory & stock */
export * as InventoryService from '@/services/inventoryService';

/** Customers */
export * as CustomerService from '@/services/customerService';

/** Analytics, KPIs, tracking */
export * as AnalyticsService from '@/services/analyticsService';

/** Public storefront reads */
export * as StorefrontService from '@/services/storefrontProductService';

/** File / image storage */
export * as StorageService from '@/services/storageService';

/** Marketing & coupons */
export * as MarketingService from '@/services/marketingService';
export * as CouponService from '@/services/couponService';

/** Named re-exports for tree-shaking convenience */
export {
  fetchStatisticsData,
  fetchDashboardStatisticsBatch,
  trackStoreVisitBySlug,
  trackProductViewBySlug,
} from '@/services/analyticsService';

export {
  signInWithPassword,
  signOut,
  getAuthSession,
  fetchUserProfile,
  exchangeAuthCodeForSession,
} from '@/services/authService';

export { fetchStoreSettings, upsertStoreSettings } from '@/services/storeService';

export { createOrder, fetchOrdersPage } from '@/services/orderService';

export { listProducts, createProduct, updateProductInDb } from '@/services/productService';

export { restockProduct } from '@/services/inventoryService';

export { uploadImage, uploadImages, deleteImage } from '@/services/storageService';
