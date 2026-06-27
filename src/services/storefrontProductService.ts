/**
 * Storefront product reads — SECURITY DEFINER RPC first, safe fallbacks when RPC/slug lookup fails.
 */
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types';
import { mapStorefrontProduct, safeMapStorefrontProduct } from '@/mappers/productMapper';
import {
  MERCHANT_PRODUCTS_LIST_SELECT,
  STOREFRONT_ACTIVE_LIST_SELECT,
  STOREFRONT_DETAIL_SELECT,
  isSchemaColumnError,
} from '@/lib/productUpdateUtils';
import { cache, CacheKeys, CacheTTL, dedup } from '@/lib/cache';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import {
  fetchStorefrontBundleViaEdge,
  fetchStorefrontPageViaEdge,
} from '@/services/storefrontEdgeService';
import {
  getStorefrontCached,
  setStorefrontCached,
  StorefrontCacheKeys,
} from '@/services/storefrontCacheService';
import { ProductCacheKeys } from '@/services/storefrontCacheTiers';
import type { StorefrontInvalidationScope } from '@/services/storefrontCacheTiers';
import type { StorefrontBundleCache, StorefrontProductsPage } from '@/types/storefrontCache';

const MINIMAL_STOREFRONT_SELECT =
  'id, name, category, price, original_price, image_url, stock_quantity, discount_type, discount_value, discount_start_date, discount_end_date, is_active, archived_at, product_slug, created_at';

export type { StorefrontInvalidationScope } from '@/services/storefrontCacheTiers';

/** Lazy-load store policies (omitted from v57 slim bundle for payload reduction). */
export async function fetchStorePolicies(
  slug: string
): Promise<{ returnPolicy: string; privacyPolicy: string }> {
  const normalized = slug.trim().toLowerCase();
  try {
    const { data, error } = await (supabase as any).rpc('get_store_policies', {
      p_slug: normalized,
    });
    if (error || !data) return { returnPolicy: '', privacyPolicy: '' };
    return {
      returnPolicy: String(data.return_policy || ''),
      privacyPolicy: String(data.privacy_policy || ''),
    };
  } catch {
    return { returnPolicy: '', privacyPolicy: '' };
  }
}

export const STOREFRONT_PRODUCTS_CHANGED = 'storefront:products-changed';

const ACTIVE_PRODUCTS_FILTER = 'is_active.eq.true,is_active.is.null';

const bundleMemoryKey = (slug: string) => StorefrontCacheKeys.bundle(slug);

/** Shared in-memory bundle cache (meta + first page) — one RPC/edge call serves both hooks. */
export function peekStorefrontBundle(slug: string): StorefrontBundleCache | null {
  return cache.get<StorefrontBundleCache>(bundleMemoryKey(slug.trim().toLowerCase()));
}

async function fetchStorefrontBundleRpc(
  slug: string,
  options: { limit?: number; cursor?: string | null; category?: string; search?: string } = {}
): Promise<StorefrontBundleCache | null> {
  const normalized = slug.trim().toLowerCase();
  try {
    const { data, error } = await (supabase as any).rpc('get_storefront_page_bundle', {
      p_slug: normalized,
      p_limit: options.limit ?? 24,
      p_cursor: options.cursor || '',
      p_category: options.category?.trim() || '',
      p_search: options.search?.trim() || '',
    });
    if (error || !data?.store) return null;
    const products = ((data.products as Record<string, unknown>[]) || [])
      .map((row) => safeMapStorefrontProduct(row))
      .filter((p): p is Product => p != null && isStorefrontVisible(p));
    const featured = ((data.featured as Record<string, unknown>[]) || [])
      .map((row) => safeMapStorefrontProduct(row))
      .filter((p): p is Product => p != null && isStorefrontVisible(p));
    return {
      store: data.store as Record<string, unknown>,
      hero: (data.hero as Record<string, unknown>) ?? null,
      categories: (data.categories as Record<string, unknown>[]) || [],
      featured,
      products,
      nextCursor: data.next_cursor || null,
      hasMore: !!data.has_more,
    };
  } catch {
    return null;
  }
}

export async function loadStorefrontBundle(
  slug: string,
  options: { limit?: number; cursor?: string | null; category?: string; search?: string } = {}
): Promise<StorefrontBundleCache | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;

  const key = bundleMemoryKey(normalized);
  const cached = getStorefrontCached<StorefrontBundleCache>(key, async () => {
    const fresh = await fetchStorefrontBundleFresh(normalized, options);
    if (fresh?.store) setStorefrontCached(key, fresh);
    return fresh!;
  });
  if (cached?.store) return cached;

  return dedup(key, () => fetchStorefrontBundleFresh(normalized, options));
}

async function fetchStorefrontBundleFresh(
  normalized: string,
  options: { limit?: number; cursor?: string | null; category?: string; search?: string } = {}
): Promise<StorefrontBundleCache | null> {
  const key = StorefrontCacheKeys.bundle(normalized);
  const edge = await fetchStorefrontBundleViaEdge(normalized, options);
    if (edge) {
      const payload: StorefrontBundleCache = {
        store: edge.storeInfo,
        categories: edge.categories,
        products: edge.products,
        nextCursor: edge.nextCursor,
        hasMore: edge.hasMore,
        cacheVersion: edge.cacheVersion,
      };
      setStorefrontCached(key, payload);
      return payload;
    }

    const rpc = await fetchStorefrontBundleRpc(normalized, options);
    if (rpc) {
      setStorefrontCached(key, rpc);
    }
    return rpc;
}

export async function resolveStoreOwnerBySlug(slug: string): Promise<string | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;

  const cachedOwner = peekStorefrontBundle(normalized)?.store?.owner_id;
  if (cachedOwner) return String(cachedOwner);

  const resolutionKey = CacheKeys.slugOwner(normalized);
  const cached = cache.get<string>(resolutionKey);
  if (cached) return cached;

  return dedup(resolutionKey, async () => {
    try {
      const { data: meta, error } = await (supabase as any).rpc('get_store_meta', { p_slug: normalized });
      if (!error && meta?.store?.owner_id) {
        const ownerId = String(meta.store.owner_id);
        cache.set(resolutionKey, ownerId, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        cache.set(CacheKeys.ownerSlug(ownerId), normalized, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        return ownerId;
      }
    } catch {
      /* RPC may be unavailable */
    }

    try {
      const { data: storeRow } = await (supabase as any)
        .from('stores')
        .select('user_id')
        .ilike('store_slug', normalized)
        .maybeSingle();
      if (storeRow?.user_id) {
        const ownerId = storeRow.user_id as string;
        cache.set(resolutionKey, ownerId, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        cache.set(CacheKeys.ownerSlug(ownerId), normalized, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        return ownerId;
      }
    } catch {
      /* stores table may not exist in older DBs */
    }

    return null;
  });
}

export async function resolveStoreSlugByOwnerId(ownerId: string): Promise<string | null> {
  if (!ownerId) return null;

  const resolutionKey = CacheKeys.ownerSlug(ownerId);
  const cached = cache.get<string>(resolutionKey);
  if (cached) return cached;

  return dedup(resolutionKey, async () => {
    const { data: settings } = await supabase
      .from('store_settings')
      .select('store_slug')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (settings?.store_slug?.trim()) {
      const slug = settings.store_slug.trim().toLowerCase();
      cache.set(resolutionKey, slug, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
      cache.set(CacheKeys.slugOwner(slug), ownerId, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
      return slug;
    }

    try {
      const { data: storeRow } = await (supabase as any)
        .from('stores')
        .select('store_slug')
        .eq('user_id', ownerId)
        .maybeSingle();
      if (storeRow?.store_slug?.trim()) {
        const slug = String(storeRow.store_slug).trim().toLowerCase();
        cache.set(resolutionKey, slug, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        cache.set(CacheKeys.slugOwner(slug), ownerId, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        return slug;
      }
    } catch {
      /* stores table may not exist in older DBs */
    }

    return null;
  });
}

export async function fetchOwnerActiveProductsByIds(
  ownerId: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  return queryProductsByIdsForOwner(ownerId, productIds);
}

async function queryProductsByIdsForOwner(
  ownerId: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  const map = new Map<string, Product>();
  if (!ownerId || productIds.length === 0) return map;

  const uniqueIds = [...new Set(productIds.filter(Boolean))];

  try {
    const { data, error } = await (supabase as any).rpc('get_owner_checkout_products_by_ids', {
      p_owner_id: ownerId,
      p_product_ids: uniqueIds,
    });
    if (!error && data) {
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const mapped = safeMapStorefrontProduct(row);
        if (mapped && isStorefrontVisible(mapped)) map.set(mapped.id, mapped);
      }
      if (map.size >= uniqueIds.length) return map;
    }
  } catch {
    /* RPC may be unavailable on older schema */
  }

  const runQuery = async (select: string, filterArchived: boolean) => {
    let query = supabase
      .from('products')
      .select(select)
      .eq('owner_id', ownerId)
      .in('id', productIds)
      .or(ACTIVE_PRODUCTS_FILTER);
    if (filterArchived) {
      query = query.is('archived_at', null);
    }
    return query;
  };

  let { data, error } = await runQuery(STOREFRONT_ACTIVE_LIST_SELECT, true);
  if (error && isSchemaColumnError(error.message)) {
    ({ data, error } = await runQuery(MERCHANT_PRODUCTS_LIST_SELECT, true));
  }
  if (error && isSchemaColumnError(error.message)) {
    ({ data, error } = await runQuery(MINIMAL_STOREFRONT_SELECT, false));
  }

  if (error || !data) return map;

  for (const row of data) {
    const mapped = safeMapStorefrontProduct(row);
    if (mapped && isStorefrontVisible(mapped)) map.set(mapped.id, mapped);
  }
  return map;
}

async function queryActiveProductsByOwner(
  ownerId: string,
  options: { category?: string; search?: string; limit?: number } = {}
): Promise<Product[]> {
  const limit = options.limit ?? 48;

  const runQuery = async (select: string, filterArchived: boolean) => {
    let query = supabase
      .from('products')
      .select(select)
      .eq('owner_id', ownerId)
      .or(ACTIVE_PRODUCTS_FILTER)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filterArchived) {
      query = query.is('archived_at', null);
    }

    if (options.category?.trim()) {
      query = query.eq('category', options.category.trim());
    }
    if (options.search?.trim()) {
      query = query.ilike('name', `%${options.search.trim()}%`);
    }

    return query;
  };

  let { data, error } = await runQuery(STOREFRONT_ACTIVE_LIST_SELECT, true);

  if (error && isSchemaColumnError(error.message)) {
    ({ data, error } = await runQuery(MERCHANT_PRODUCTS_LIST_SELECT, true));
  }

  if (error && isSchemaColumnError(error.message)) {
    ({ data, error } = await runQuery(MINIMAL_STOREFRONT_SELECT, false));
  }

  if (error) {
    console.error('[storefront] direct product query failed:', error);
    return [];
  }

  return (data ?? [])
    .map((row) => safeMapStorefrontProduct(row))
    .filter((p): p is Product => p != null && isStorefrontVisible(p));
}

/** SECURITY DEFINER RPC — works for anonymous customers (bypasses RLS). */
async function fetchProductsViaSlugRpc(slug: string): Promise<Product[]> {
  try {
    const { data, error } = await (supabase as any).rpc('get_store_products_by_slug', {
      p_slug: slug.trim().toLowerCase(),
    });

    if (error) {
      console.warn('[storefront] get_store_products_by_slug failed:', error.message);
      return [];
    }

    return ((data as Record<string, unknown>[]) ?? [])
      .map((row) => safeMapStorefrontProduct(row))
      .filter((p): p is Product => p != null && isStorefrontVisible(p));
  } catch (err) {
    console.warn('[storefront] get_store_products_by_slug unavailable:', err);
    return [];
  }
}

function applyClientFilters(
  products: Product[],
  options: { category?: string; search?: string; limit?: number }
): Product[] {
  let filtered = products.filter(isStorefrontVisible);

  if (options.category?.trim()) {
    filtered = filtered.filter((p) => p.category === options.category!.trim());
  }
  if (options.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }

  const limit = options.limit ?? 24;
  return filtered.slice(0, limit);
}

export async function fetchStorefrontProductsByOwnerId(
  ownerId: string,
  options: { category?: string; search?: string; limit?: number } = {}
): Promise<Product[]> {
  return queryActiveProductsByOwner(ownerId, options);
}

const pageFromBundle = (
  bundle: StorefrontBundleCache
): StorefrontProductsPage => ({
  products: bundle.products ?? [],
  nextCursor: bundle.nextCursor ?? null,
  hasMore: !!bundle.hasMore,
});

/** Sync fast-path for hooks — avoids duplicate RPC when bundle already loaded. */
export function getStorefrontFirstPageFromCache(slug: string): StorefrontProductsPage | null {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;
  const bundle = peekStorefrontBundle(normalized);
  if (!bundle?.store || !bundle.products) return null;
  return pageFromBundle(bundle);
}

export async function fetchStorefrontProductsPage(
  slug: string,
  options: {
    limit?: number;
    cursor?: string | null;
    category?: string;
    search?: string;
  } = {}
): Promise<StorefrontProductsPage> {
  const normalized = slug.trim().toLowerCase();
  const limit = options.limit ?? 24;
  const category = options.category?.trim() || '';
  const search = options.search?.trim() || '';
  const cursor = options.cursor || '';

  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return { products: [], nextCursor: null, hasMore: false };
  }

  const isFirstPage = !cursor && !category && !search;
  if (isFirstPage) {
    const cachedBundle = peekStorefrontBundle(normalized);
    if (cachedBundle?.products) {
      return pageFromBundle(cachedBundle);
    }
    const pageCacheKey = ProductCacheKeys.page(normalized, '', '', '', limit);
    const cachedPage = cache.get<StorefrontProductsPage>(pageCacheKey);
    if (cachedPage?.products) {
      return cachedPage;
    }
  }

  const dedupeKey = ProductCacheKeys.page(normalized, cursor, category, search, limit);

  return dedup(dedupeKey, async () => {
    if (isFirstPage) {
      const bundle = peekStorefrontBundle(normalized) ?? (await loadStorefrontBundle(normalized, options));
      if (bundle?.products) {
        const page = pageFromBundle(bundle);
        cache.set(dedupeKey, page, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        return page;
      }
    }

    const edgePage = await fetchStorefrontPageViaEdge(normalized, {
      limit,
      cursor: cursor || null,
      category: category || undefined,
      search: search || undefined,
    });
    if (edgePage) return edgePage;

    try {
      const { data, error } = await (supabase as any).rpc('get_store_products_page', {
        p_slug: normalized,
        p_limit: limit,
        p_cursor: cursor,
        p_category: category,
        p_search: search,
      });

      if (!error && data?.products !== undefined) {
        const mapped = ((data.products as Record<string, unknown>[]) || [])
          .map((row) => safeMapStorefrontProduct(row))
          .filter((p): p is Product => p != null && isStorefrontVisible(p));

        if (mapped.length > 0 || cursor) {
          return {
            products: mapped,
            nextCursor: data.next_cursor || null,
            hasMore: !!data.has_more,
          };
        }

        const ownerId = await resolveStoreOwnerBySlug(normalized);
        if (ownerId && !category && !search) {
          return {
            products: mapped,
            nextCursor: data.next_cursor || null,
            hasMore: !!data.has_more,
          };
        }
      }

      if (error) {
        console.warn('[storefront] RPC get_store_products_page failed, trying fallbacks:', error.message);
      }
    } catch (err) {
      console.warn('[storefront] RPC unavailable, trying fallbacks:', err);
    }

    if (category || search) {
      const ownerId = await resolveStoreOwnerBySlug(normalized);
      if (!ownerId) return { products: [], nextCursor: null, hasMore: false };
      const products = await queryActiveProductsByOwner(ownerId, { category, search, limit });
      return { products, nextCursor: null, hasMore: false };
    }

    const slugRpcProducts = await fetchProductsViaSlugRpc(normalized);
    if (slugRpcProducts.length > 0) {
      return { products: slugRpcProducts.slice(0, limit), nextCursor: null, hasMore: false };
    }

    const ownerId = await resolveStoreOwnerBySlug(normalized);
    if (!ownerId) {
      return { products: [], nextCursor: null, hasMore: false };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id === ownerId) {
      const products = await queryActiveProductsByOwner(ownerId, { limit });
      return { products, nextCursor: null, hasMore: false };
    }

    return { products: [], nextCursor: null, hasMore: false };
  });
}

/** Single product for storefront detail page — RPC + slug catalog fallback (works for anon). */
export async function fetchStorefrontProductById(
  slug: string,
  productId: string
): Promise<Product | null> {
  const normalized = slug.trim().toLowerCase();
  const id = productId.trim();
  if (!/^[a-z0-9-]+$/.test(normalized) || !id) return null;

  const productCacheKey = StorefrontCacheKeys.product(normalized, id);
  const cachedProduct = getStorefrontCached<Product>(productCacheKey);
  if (cachedProduct) return cachedProduct;

  return dedup(productCacheKey, async () => {
    const product = await fetchStorefrontProductByIdUncached(normalized, id);
    if (product) {
      setStorefrontCached(productCacheKey, product);
    }
    return product;
  });
}

async function fetchStorefrontProductByIdUncached(
  normalized: string,
  id: string
): Promise<Product | null> {
  try {
    const { data, error } = await (supabase as any).rpc('get_store_product_by_id', {
      p_slug: normalized,
      p_product_id: id,
    });

    if (!error && data) {
      const mapped = safeMapStorefrontProduct(data);
      if (mapped && isStorefrontVisible(mapped)) return mapped;
    }

    if (error) {
      console.warn('[storefront] get_store_product_by_id failed:', error.message);
    }

    const ownerId = await resolveStoreOwnerBySlug(normalized);
    if (ownerId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id === ownerId) {
        let { data: row, error: queryError } = await supabase
          .from('products')
          .select(STOREFRONT_DETAIL_SELECT)
          .eq('id', id)
          .eq('owner_id', ownerId)
          .or(ACTIVE_PRODUCTS_FILTER)
          .maybeSingle();

        if (queryError && isSchemaColumnError(queryError.message)) {
          ({ data: row, error: queryError } = await supabase
            .from('products')
            .select(MINIMAL_STOREFRONT_SELECT)
            .eq('id', id)
            .eq('owner_id', ownerId)
            .or(ACTIVE_PRODUCTS_FILTER)
            .maybeSingle());
        }

        if (row) {
          const mapped = safeMapStorefrontProduct(row);
          if (mapped) return mapped;
        }
      }
    }

    return null;
  } catch (err) {
    console.error('[storefront] fetchStorefrontProductById failed:', err);
    return null;
  }
}

/** Batch RPC fetch — single round-trip for checkout validation. */
export async function fetchCheckoutProductsByIds(
  slug: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  const map = new Map<string, Product>();
  const normalized = slug.trim().toLowerCase();
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (!/^[a-z0-9-]+$/.test(normalized) || uniqueIds.length === 0) return map;

  try {
    const { data, error } = await (supabase as any).rpc('get_checkout_products_by_ids', {
      p_slug: normalized,
      p_product_ids: uniqueIds,
    });
    if (!error && data) {
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const mapped = safeMapStorefrontProduct(row);
        if (mapped && isStorefrontVisible(mapped)) map.set(mapped.id, mapped);
      }
      if (map.size > 0) return map;
    }
  } catch {
    /* fall through to owner-scoped batch */
  }

  const missingIds = uniqueIds.filter((id) => !map.has(id));
  if (missingIds.length > 0) {
    const ownerId = await resolveStoreOwnerBySlug(normalized);
    if (ownerId) {
      const ownerMap = await queryProductsByIdsForOwner(ownerId, missingIds);
      for (const [id, product] of ownerMap) {
        if (isStorefrontVisible(product)) map.set(id, product);
      }
    }
  }

  return map;
}

export interface CheckoutPreflightResult {
  products: Map<string, Product>;
  deliveryFee: number | null;
  coupon: { code: string; discountAmount: number } | null;
}

/** Single RPC — products + delivery + coupon validation for checkout submit. */
export async function fetchCheckoutPreflightBundle(
  slug: string,
  productIds: string[],
  options: {
    governorate?: string;
    couponCode?: string;
    subtotal?: number;
  } = {}
): Promise<CheckoutPreflightResult | null> {
  const normalized = slug.trim().toLowerCase();
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (!/^[a-z0-9-]+$/.test(normalized) || uniqueIds.length === 0) return null;

  try {
    const { data, error } = await (supabase as any).rpc('get_checkout_preflight_bundle', {
      p_slug: normalized,
      p_product_ids: uniqueIds,
      p_governorate: options.governorate?.trim() || null,
      p_coupon_code: options.couponCode?.trim() || null,
      p_subtotal: options.subtotal ?? null,
    });
    if (error || !data) return null;

    const products = new Map<string, Product>();
    const rows = Array.isArray(data.products) ? data.products : [];
    for (const row of rows) {
      const mapped = safeMapStorefrontProduct(row);
      if (mapped && isStorefrontVisible(mapped)) products.set(mapped.id, mapped);
    }

    let coupon: CheckoutPreflightResult['coupon'] = null;
    const rawCoupon = data.coupon as Record<string, unknown> | null;
    if (rawCoupon?.valid === true && rawCoupon.code) {
      coupon = {
        code: String(rawCoupon.code),
        discountAmount: Number(rawCoupon.discount_amount ?? 0),
      };
    }

    return {
      products,
      deliveryFee: data.delivery_fee != null ? Number(data.delivery_fee) : null,
      coupon,
    };
  } catch {
    return null;
  }
}

/** Batch product fetch for checkout — delegates to single RPC round-trip. */
export async function fetchStorefrontProductsByIds(
  slug: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  return fetchCheckoutProductsByIds(slug, productIds);
}

export async function bumpStorefrontCacheVersion(ownerId: string): Promise<number | null> {
  return (await import('@/services/write/storefront/storefrontCacheWriteService')).bumpStorefrontCacheVersion(ownerId);
}

export {
  invalidateStorefrontScope,
  invalidateStorefrontForOwner,
} from '@/services/write/storefront/storefrontCacheWriteService';

