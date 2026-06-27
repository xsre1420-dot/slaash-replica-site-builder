/**
 * Invalidate merchant product + storefront caches after CRUD mutations.
 */
import { syncMerchantProductCatalog } from '@/services/merchantProductCatalogService';

export const syncProductCachesAfterMutation = syncMerchantProductCatalog;
