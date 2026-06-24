/**
 * Invalidate merchant product + storefront caches after CRUD mutations.
 */
import { syncMerchantProductCatalog } from '@/data/dummyData';

export const syncProductCachesAfterMutation = syncMerchantProductCatalog;
