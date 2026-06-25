/**
 * Storefront reads via Supabase Edge Function — shared HTTP cache across users.
 * Falls back to direct RPC when edge is unavailable or disabled.
 */
import { env } from '@/lib/env';
import { dedup } from '@/lib/cache';
import {
  getStorefrontCached,
  setStorefrontCached,
  StorefrontCacheKeys,
} from '@/services/storefrontCacheService';
import { Product } from '@/types';
import { safeMapStorefrontProduct } from '@/mappers/productMapper';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import type { StorefrontProductsPage } from '@/types/storefrontCache';

export interface StorefrontEdgeBundle {
  storeInfo: Record<string, unknown>;
  categories: Record<string, unknown>[];
  products: Product[];
  nextCursor: string | null;
  hasMore: boolean;
}

const edgeDisabled = () =>
  import.meta.env.VITE_STOREFRONT_EDGE_ENABLED === 'false' ||
  import.meta.env.VITE_STOREFRONT_EDGE_ENABLED === '0';

export function resolveStorefrontEdgeUrl(): string | null {
  if (edgeDisabled()) return null;

  const explicit = import.meta.env.VITE_STOREFRONT_EDGE_URL as string | undefined;
  if (explicit?.trim()) {
    return explicit.trim().replace(/\/$/, '');
  }

  const base = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/functions/v1/get-store-products`;
}

async function postEdge<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T | null> {
  const url = resolveStorefrontEdgeUrl();
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error || json?.success === false) return null;
    return json as T;
  } catch {
    return null;
  }
}

function mapProducts(rows: Record<string, unknown>[]): Product[] {
  return (rows ?? [])
    .map((row) => safeMapStorefrontProduct(row))
    .filter((p): p is Product => p != null && isStorefrontVisible(p));
}

/** Meta + first product page in one edge round-trip (CDN-cacheable). */
export async function fetchStorefrontBundleViaEdge(
  slug: string,
  options: { limit?: number; cursor?: string | null; category?: string; search?: string } = {}
): Promise<StorefrontEdgeBundle | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;

  const cacheKey = StorefrontCacheKeys.edgeBundle(
    normalized,
    options.cursor || '',
    options.category || '',
    options.search || ''
  );

  const cached = getStorefrontCached<StorefrontEdgeBundle>(cacheKey);
  if (cached) return cached;

  return dedup(cacheKey, async () => {
    const data = await postEdge<{
      storeInfo?: Record<string, unknown>;
      categories?: Record<string, unknown>[];
      products?: Record<string, unknown>[];
      next_cursor?: string | null;
      has_more?: boolean;
    }>({
      slug: normalized,
      bundle: true,
      limit: options.limit ?? 24,
      cursor: options.cursor || '',
      category: options.category || '',
      search: options.search || '',
    });

    if (!data?.storeInfo) return null;

    const payload: StorefrontEdgeBundle = {
      storeInfo: data.storeInfo,
      categories: data.categories ?? [],
      products: mapProducts(data.products ?? []),
      nextCursor: data.next_cursor ?? null,
      hasMore: !!data.has_more,
    };
    setStorefrontCached(cacheKey, payload);
    return payload;
  });
}

/** Products page only via edge (pagination / filters). */
export async function fetchStorefrontPageViaEdge(
  slug: string,
  options: {
    limit?: number;
    cursor?: string | null;
    category?: string;
    search?: string;
  } = {}
): Promise<StorefrontProductsPage | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;

  const cacheKey = StorefrontCacheKeys.edgePage(
    normalized,
    options.cursor || '',
    options.category || '',
    options.search || ''
  );

  const cached = getStorefrontCached<StorefrontProductsPage>(cacheKey);
  if (cached) return cached;

  return dedup(cacheKey, async () => {
    const data = await postEdge<{
      products?: Record<string, unknown>[];
      next_cursor?: string | null;
      has_more?: boolean;
    }>({
      slug: normalized,
      limit: options.limit ?? 24,
      cursor: options.cursor || '',
      category: options.category || '',
      search: options.search || '',
      page: true,
      metaOnly: false,
    });

    if (!data?.products) return null;

    const payload: StorefrontProductsPage = {
      products: mapProducts(data.products),
      nextCursor: data.next_cursor ?? null,
      hasMore: !!data.has_more,
    };
    setStorefrontCached(cacheKey, payload);
    return payload;
  });
}
