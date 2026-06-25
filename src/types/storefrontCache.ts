import type { Product } from '@/types';

export interface StorefrontBundleCache {
  store?: Record<string, unknown>;
  categories?: Record<string, unknown>[];
  products?: Product[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface StorefrontProductsPage {
  products: Product[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TenantMetaCache {
  storeInfo: Record<string, unknown> & { ownerId?: string; storeSlug?: string };
  categories: { id: string; name: string; order: number }[];
}
