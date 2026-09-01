/**
 * Storefront product reads — SECURITY DEFINER RPC first, safe fallbacks when RPC/slug lookup fails.
 */
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types';
import { mapStorefrontProduct, safeMapStorefrontProduct, mapDbProduct } from '@/mappers/productMapper';
import {
  MERCHANT_PRODUCTS_LIST_SELECT,
  STOREFRONT_ACTIVE_LIST_SELECT,
  STOREFRONT_DETAIL_SELECT,
  isSchemaColumnError,
} from '@/lib/productUpdateUtils';
import { cache, CacheKeys, CacheTTL, dedup, peekInflight } from '@/lib/cache';
import { cachedFetchNullable } from '@/lib/cache/enterpriseCache';
import { callReadRpc } from '@/lib/readWrite/readClient';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import { hydrateProductVariantOptions } from '@/utils/inventoryUtils';
import {
  fetchStorefrontBundleViaEdge,
  fetchStorefrontPageViaEdge,
} from '@/services/storefrontEdgeService';
import {
  getStorefrontCached,
  setStorefrontCached,
  getStorefrontBundleFromCache,
  setStorefrontBundleInCache,
  peekStorefrontBundleEntry,
  StorefrontCacheKeys,
} from '@/services/storefrontCacheService';
import { ProductCacheKeys, flushStorefrontProductDetail } from '@/services/storefrontCacheTiers';
import type { StorefrontInvalidationScope } from '@/services/storefrontCacheTiers';
import type { StorefrontBundleCache, StorefrontProductsPage } from '@/types/storefrontCache';
import { traceCriticalFlow } from '@/lib/tracing';
import {
  getStorefrontReadRpcOptions,
  isStorefrontBundleFirstPage,
  STOREFRONT_BUNDLE_RPC,
  storefrontBundleInflightKey,
  storefrontBundleStampedeKey,
  type StorefrontBundleRequestOptions,
} from '@/lib/storefront/storefrontRpcConfig';
import { logStorefrontRequest } from '@/lib/storefront/storefrontRequestDebug';
import { awaitStorefrontBundleReady } from '@/lib/storefront/storefrontLoadCoordinator';
import { isStorefrontEdgeActive } from '@/services/storefrontEdgeService';
import { cacheGet, cacheSet } from '@/utils/indexedDB';
import { CacheTTLPolicy } from '@/lib/cache/cacheTtlPolicy';
import { recordStorefrontCacheHit, recordStorefrontCacheMiss } from '@/services/storefrontCacheTiers';

const MINIMAL_STOREFRONT_SELECT =
  'id, name, category, price, original_price, image_url, stock_quantity, discount_type, discount_value, discount_start_date, discount_end_date, is_active, archived_at, product_slug, created_at';

export type { StorefrontInvalidationScope } from '@/services/storefrontCacheTiers';

/** Lazy-load store policies (omitted from v57 slim bundle for payload reduction). */
export async function fetchStorePolicies(
  slug: string
): Promise<{ returnPolicy: string; privacyPolicy: string }> {
  const normalized = slug.trim().toLowerCase();
  const result = await cachedFetchNullable({
    key: `storefront-policies:${normalized}`,
    domain: 'storefront',
    ttlPolicyPath: 'static.policies',
    fetchFn: async () => {
      const { data, error } = await callReadRpc<Record<string, unknown>>('get_store_policies', {
        p_slug: normalized,
      });
      if (error || !data) return { returnPolicy: '', privacyPolicy: '' };
      return {
        returnPolicy: String(data.return_policy || ''),
        privacyPolicy: String(data.privacy_policy || ''),
      };
    },
  });
  return result ?? { returnPolicy: '', privacyPolicy: '' };
}

export const STOREFRONT_PRODUCTS_CHANGED = 'storefront:products-changed';

const ACTIVE_PRODUCTS_FILTER = 'is_active.eq.true,is_active.is.null';

const DETAIL_ENRICH_SELECT =
  'image_url, additional_images, tags, sku, short_description, description, sizes, colors, variants, stock_quantity, is_active, archived_at, owner_id';

const countGalleryUrls = (product: Pick<Product, 'image' | 'additionalImages'>): number => {
  const seen = new Set<string>();
  const main = product.image?.trim();
  if (main) seen.add(main);
  for (const url of product.additionalImages ?? []) {
    const trimmed = url?.trim();
    if (trimmed) seen.add(trimmed);
  }
  return seen.size;
};

/** RPC/detail SELECT already includes gallery, variants, and stock — skip redundant enrich round-trip. */
export function isStorefrontProductDetailComplete(product: Product): boolean {
  return (
    product.stockQuantity != null &&
    Boolean(product.image?.trim() || (product.additionalImages?.length ?? 0) > 0)
  );
}

/** Load detail fields from DB — source of truth when RPC payload omits tags/gallery. */
async function enrichStorefrontProductDetail(
  slug: string,
  productId: string,
  product: Product
): Promise<Product> {
  const ownerId = await resolveStoreOwnerBySlug(slug);
  if (!ownerId) return product;

  const { data: row, error } = await supabase
    .from('products')
    .select(DETAIL_ENRICH_SELECT)
    .eq('id', productId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error || !row || row.is_active === false || row.archived_at) return product;

  const fromDb = mapDbProduct({
    id: productId,
    name: product.name,
    price: product.price,
    category: product.category,
    description: row.description,
    image_url: row.image_url,
    additional_images: row.additional_images,
    tags: row.tags,
    sku: row.sku,
    short_description: row.short_description,
    sizes: row.sizes,
    colors: row.colors,
    variants: row.variants,
    stock_quantity: row.stock_quantity,
  });

  const freshGalleryCount = countGalleryUrls(fromDb);
  const cachedGalleryCount = countGalleryUrls(product);
  const useFreshGallery = freshGalleryCount >= cachedGalleryCount;

  const merged: Product = {
    ...product,
    description: fromDb.description?.trim() || product.description,
    image: useFreshGallery ? fromDb.image || product.image : product.image?.trim() || fromDb.image,
    additionalImages: useFreshGallery
      ? fromDb.additionalImages ?? product.additionalImages
      : product.additionalImages?.length
        ? product.additionalImages
        : fromDb.additionalImages,
    tags: row.tags != null ? (fromDb.tags ?? []) : product.tags,
    sku: fromDb.sku || product.sku,
    shortDescription: fromDb.shortDescription?.trim() || product.shortDescription,
    sizes: fromDb.sizes?.length ? fromDb.sizes : product.sizes,
    colors: fromDb.colors?.length ? fromDb.colors : product.colors,
    variants: fromDb.variants?.length ? fromDb.variants : product.variants,
    stockQuantity: fromDb.stockQuantity ?? product.stockQuantity,
  };

  return hydrateProductVariantOptions(merged);
}

const STOREFRONT_BUNDLE_IDB_TTL = CacheTTLPolicy.static.browser_idb_storefront.ttlMs;

/** Shared in-memory bundle cache (meta + first page) — one RPC/edge call serves both hooks. */
export function peekStorefrontBundle(slug: string): StorefrontBundleCache | null {
  return peekStorefrontBundleEntry(slug.trim().toLowerCase(), {});
}

function createBundleRevalidate(
  normalized: string,
  options: StorefrontBundleRequestOptions
): () => Promise<StorefrontBundleCache> {
  const stampedeKey = storefrontBundleStampedeKey(normalized, options);
  return () =>
    dedup(stampedeKey, async () => {
      const fresh = await fetchStorefrontBundleFresh(normalized, options);
      if (!fresh?.store) throw new Error('storefront bundle revalidate empty');
      setStorefrontBundleInCache(normalized, options, fresh);
      persistStorefrontBundleIdb(normalized, options, fresh);
      return fresh;
    });
}

async function readStorefrontBundleFromIdb(
  normalized: string,
  options: StorefrontBundleRequestOptions
): Promise<StorefrontBundleCache | null> {
  if (!isStorefrontBundleFirstPage(options)) return null;
  try {
    const fromIdb = await cacheGet<StorefrontBundleCache>(
      StorefrontCacheKeys.bundleIdb(normalized, options),
      STOREFRONT_BUNDLE_IDB_TTL
    );
    if (fromIdb?.store) {
      setStorefrontBundleInCache(normalized, options, fromIdb);
      recordStorefrontCacheHit('store');
      logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'cache_hit', { slug: normalized, source: 'idb' });
      return fromIdb;
    }
  } catch {
    /* IDB unavailable */
  }
  return null;
}

function persistStorefrontBundleIdb(
  normalized: string,
  options: StorefrontBundleRequestOptions,
  bundle: StorefrontBundleCache
): void {
  if (!isStorefrontBundleFirstPage(options) || !bundle?.store) return;
  void cacheSet(StorefrontCacheKeys.bundleIdb(normalized, options), bundle);
}

async function fetchStorefrontBundleRpc(
  slug: string,
  options: StorefrontBundleRequestOptions = {}
): Promise<StorefrontBundleCache | null> {
  const normalized = slug.trim().toLowerCase();
  const rpcInflightKey = storefrontBundleInflightKey(normalized, options, 'rpc');

  if (peekInflight(rpcInflightKey)) {
    logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'dedup_hit', { slug: normalized, scope: 'rpc' });
  }

  return dedup(rpcInflightKey, async () => {
    try {
      logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'start', { slug: normalized });
      const started = Date.now();
      const { data, error } = await callReadRpc<Record<string, unknown>>(
        STOREFRONT_BUNDLE_RPC,
        {
          p_slug: normalized,
          p_limit: options.limit ?? 24,
          p_cursor: options.cursor || '',
          p_category: options.category?.trim() || '',
          p_search: options.search?.trim() || '',
        },
        getStorefrontReadRpcOptions({ preferEdge: true })
      );
      const durationMs = Date.now() - started;
      if (error || !data?.store) {
        logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'error', { durationMs, message: error?.slice(0, 80) });
        return null;
      }
      logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'end', { durationMs });
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
  });
}

/** Single coordinated entry for first-page storefront data — deduped across hooks. */
export async function ensureStorefrontPageBundle(
  slug: string,
  options: StorefrontBundleRequestOptions = {}
): Promise<StorefrontBundleCache | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;

  const cached =
    peekStorefrontBundle(normalized) ?? getStorefrontBundleFromCache(normalized, options);
  if (cached?.store) return cached;

  await awaitStorefrontBundleReady(normalized, options);
  const warmed =
    peekStorefrontBundle(normalized) ?? getStorefrontBundleFromCache(normalized, options);
  if (warmed?.store) return warmed;

  return loadStorefrontBundle(normalized, options);
}

/** Reuse a product from the warmed storefront bundle listing cache. */
export function findStorefrontListProduct(slug: string, productId: string): Product | null {
  const normalized = slug.trim().toLowerCase();
  const id = productId.trim();
  if (!id) return null;

  const bundle = peekStorefrontBundle(normalized);
  const fromList = bundle?.products?.find((p) => p.id === id);
  if (fromList) return fromList;

  const featured = bundle?.featured?.find((p) => p.id === id);
  return featured ?? null;
}

export type ProductDetailBundleOptions = {
  initialProduct?: Product | null;
  /** When true (default), refresh complete cached products in the background. */
  backgroundRevalidate?: boolean;
};

/** Coordinated product detail load — reuses storefront listing cache before RPC. */
export async function loadProductDetailBundle(
  slug: string,
  productId: string,
  options: ProductDetailBundleOptions = {}
): Promise<Product | null> {
  const normalized = slug.trim().toLowerCase();
  const id = productId.trim();
  if (!/^[a-z0-9-]+$/.test(normalized) || !id) return null;

  const detailKey = CacheKeys.productDetail(normalized, id);
  const productCacheKey = StorefrontCacheKeys.product(normalized, id);

  const cachedDetail = getStorefrontCached<Product>(productCacheKey);
  if (cachedDetail && isStorefrontProductDetailComplete(cachedDetail)) {
    if (options.backgroundRevalidate !== false) {
      void dedup(detailKey, () =>
        fetchStorefrontProductById(normalized, id, { revalidate: true })
      ).catch(() => undefined);
    }
    return cachedDetail;
  }

  const seed =
    options.initialProduct?.id === id
      ? options.initialProduct
      : findStorefrontListProduct(normalized, id);

  if (seed && isStorefrontProductDetailComplete(seed)) {
    setStorefrontCached(productCacheKey, seed);
    if (options.backgroundRevalidate !== false) {
      void dedup(detailKey, () =>
        fetchStorefrontProductById(normalized, id, { revalidate: true })
      ).catch(() => undefined);
    }
    return hydrateProductVariantOptions(seed);
  }

  if (seed) {
    setStorefrontCached(productCacheKey, seed);
  }

  return dedup(detailKey, () => fetchStorefrontProductById(normalized, id));
}

export async function loadStorefrontBundle(
  slug: string,
  options: StorefrontBundleRequestOptions = {}
): Promise<StorefrontBundleCache | null> {
  return traceCriticalFlow('storefront.load', 'frontend', 'loadBundle', async () => {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;

  const stampedeKey = storefrontBundleStampedeKey(normalized, options);
  const revalidate = createBundleRevalidate(normalized, options);

  const cached = getStorefrontBundleFromCache(normalized, options, revalidate);
  if (cached?.store) {
    recordStorefrontCacheHit('store');
    logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'cache_hit', { slug: normalized });
    return cached;
  }

  await awaitStorefrontBundleReady(normalized, options);
  const warmedAfterWait = getStorefrontBundleFromCache(normalized, options);
  if (warmedAfterWait?.store) {
    recordStorefrontCacheHit('store');
    logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'cache_hit', { slug: normalized });
    return warmedAfterWait;
  }

  if (peekInflight(stampedeKey)) {
    logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'dedup_hit', { slug: normalized, scope: 'stampede' });
  }

  return dedup(stampedeKey, async () => {
    const warm = getStorefrontBundleFromCache(normalized, options);
    if (warm?.store) {
      recordStorefrontCacheHit('store');
      logStorefrontRequest(STOREFRONT_BUNDLE_RPC, 'cache_hit', { slug: normalized });
      return warm;
    }

    const fromIdb = await readStorefrontBundleFromIdb(normalized, options);
    if (fromIdb?.store) return fromIdb;

    recordStorefrontCacheMiss('store');
    const fresh = await fetchStorefrontBundleFresh(normalized, options);
    if (fresh?.store) {
      setStorefrontBundleInCache(normalized, options, fresh);
      persistStorefrontBundleIdb(normalized, options, fresh);
    }
    return fresh;
  });
  }, { slug, search: options.search });
}

async function fetchStorefrontBundleFresh(
  normalized: string,
  options: StorefrontBundleRequestOptions = {}
): Promise<StorefrontBundleCache | null> {
  if (isStorefrontEdgeActive()) {
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
      setStorefrontBundleInCache(normalized, options, payload);
      return payload;
    }
  }

  const rpc = await fetchStorefrontBundleRpc(normalized, options);
  if (rpc?.store) {
    setStorefrontBundleInCache(normalized, options, rpc);
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
    const bundleOwner = peekStorefrontBundle(normalized)?.store?.owner_id;
    if (bundleOwner) {
      const ownerId = String(bundleOwner);
      cache.set(resolutionKey, ownerId, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
      cache.set(CacheKeys.ownerSlug(ownerId), normalized, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
      return ownerId;
    }

    try {
      const { data: settingsRow } = await supabase
        .from('store_settings')
        .select('owner_id')
        .ilike('store_slug', normalized)
        .maybeSingle();
      if (settingsRow?.owner_id) {
        const ownerId = settingsRow.owner_id as string;
        cache.set(resolutionKey, ownerId, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        cache.set(CacheKeys.ownerSlug(ownerId), normalized, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        return ownerId;
      }
    } catch {
      /* store_settings may be unavailable */
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
    const { data, error } = await callReadRpc<Record<string, unknown>[]>('get_owner_checkout_products_by_ids', {
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
    const { data, error } = await callReadRpc<Record<string, unknown>[]>('get_store_products_by_slug', {
      p_slug: slug.trim().toLowerCase(),
    }, { preferEdge: true });

    if (error) {
      console.warn('[storefront] get_store_products_by_slug failed:', error);
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
  if (!bundle?.store || bundle.products == null) return null;
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
  const flow = options.search?.trim() ? 'product.search' : 'storefront.load';
  return traceCriticalFlow(flow as 'product.search' | 'storefront.load', 'frontend', 'productsPage', async () => {
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

    await awaitStorefrontBundleReady(normalized, options);
    const bundleAfterWait = peekStorefrontBundle(normalized);
    if (bundleAfterWait?.products) {
      return pageFromBundle(bundleAfterWait);
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
      await awaitStorefrontBundleReady(normalized, options);
      const bundle =
        peekStorefrontBundle(normalized) ?? (await ensureStorefrontPageBundle(normalized, options));
      if (bundle?.store) {
        const page = pageFromBundle(bundle);
        cache.set(dedupeKey, page, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
        return page;
      }
      return { products: [], nextCursor: null, hasMore: false };
    }

    const edgePage = await fetchStorefrontPageViaEdge(normalized, {
      limit,
      cursor: cursor || null,
      category: category || undefined,
      search: search || undefined,
    });
    if (edgePage) return edgePage;

    try {
      const { data, error } = await callReadRpc<Record<string, unknown>>('get_store_products_page', {
        p_slug: normalized,
        p_limit: limit,
        p_cursor: cursor,
        p_category: category,
        p_search: search,
      }, { preferEdge: true });

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
        console.warn('[storefront] RPC get_store_products_page failed, trying fallbacks:', error);
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
  }, { slug, search: options.search });
}

/** Single product for storefront detail page — RPC + slug catalog fallback (works for anon). */
export async function fetchStorefrontProductById(
  slug: string,
  productId: string,
  options?: { bypassCache?: boolean; revalidate?: boolean }
): Promise<Product | null> {
  const normalized = slug.trim().toLowerCase();
  const id = productId.trim();
  if (!/^[a-z0-9-]+$/.test(normalized) || !id) return null;

  const productCacheKey = StorefrontCacheKeys.product(normalized, id);
  if (options?.bypassCache) {
    flushStorefrontProductDetail(normalized, id);
    const product = await fetchStorefrontProductByIdUncached(normalized, id);
    if (product) {
      setStorefrontCached(productCacheKey, product);
    }
    return product;
  }

  if (options?.revalidate) {
    const revalidateFn = async () => {
      const product = await fetchStorefrontProductByIdUncached(normalized, id);
      if (product) setStorefrontCached(productCacheKey, product);
      return product;
    };
    const cachedProduct = getStorefrontCached<Product>(productCacheKey, revalidateFn);
    if (cachedProduct) return cachedProduct;
  } else {
    const cachedProduct = getStorefrontCached<Product>(productCacheKey);
    if (cachedProduct) return cachedProduct;
  }

  return dedup(productCacheKey, async () => {
    const product = await fetchStorefrontProductByIdUncached(normalized, id);
    if (product) {
      setStorefrontCached(productCacheKey, product);
    }
    return product;
  });
}

async function finalizeStorefrontProduct(
  slug: string,
  productId: string,
  product: Product | null
): Promise<Product | null> {
  if (!product || !isStorefrontVisible(product)) return null;
  if (isStorefrontProductDetailComplete(product)) {
    return hydrateProductVariantOptions(product);
  }
  return enrichStorefrontProductDetail(slug, productId, product);
}

async function fetchStorefrontProductByIdUncached(
  normalized: string,
  id: string
): Promise<Product | null> {
  try {
    const { data, error } = await callReadRpc<Record<string, unknown>>('get_store_product_by_id', {
      p_slug: normalized,
      p_product_id: id,
    }, { preferEdge: true });

    if (!error && data) {
      const mapped = await finalizeStorefrontProduct(normalized, id, safeMapStorefrontProduct(data));
      if (mapped) return mapped;
    }

    if (error) {
      console.warn('[storefront] get_store_product_by_id failed:', error);
    }

    const ownerId = await resolveStoreOwnerBySlug(normalized);
    if (ownerId) {
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
        const mapped = await finalizeStorefrontProduct(normalized, id, safeMapStorefrontProduct(row));
        if (mapped) return mapped;
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
    const { data, error } = await callReadRpc<Record<string, unknown>[]>('get_checkout_products_by_ids', {
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
    const { data, error } = await callReadRpc<Record<string, unknown>>('get_checkout_preflight_bundle', {
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

