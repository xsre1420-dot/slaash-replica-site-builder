import type { Product } from '@/types';

export interface StorefrontBundleCache {
  store?: Record<string, unknown>;
  hero?: Record<string, unknown> | null;
  categories?: Record<string, unknown>[];
  featured?: Product[];
  products?: Product[];
  nextCursor?: string | null;
  hasMore?: boolean;
  cacheVersion?: number;
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
