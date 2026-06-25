/**
 * Invalidate merchant product + storefront caches after CRUD mutations.
 */
import { syncMerchantProductCatalog } from '@/services/productService';

export const syncProductCachesAfterMutation = syncMerchantProductCatalog;
