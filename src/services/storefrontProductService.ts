/**
 * Storefront product reads — SECURITY DEFINER RPC first, safe fallbacks when RPC/slug lookup fails.
 */
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types';
import { mapStorefrontProduct, safeMapStorefrontProduct } from '@/mappers/productMapper';
import {
  MERCHANT_PRODUCTS_LIST_SELECT,
  isSchemaColumnError,
} from '@/lib/productUpdateUtils';
import { cache, CacheTTL, dedup } from '@/lib/cache';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import {
  fetchStorefrontBundleViaEdge,
  fetchStorefrontPageViaEdge,
} from '@/services/storefrontEdgeService';

const MINIMAL_STOREFRONT_SELECT =
  'id, name, description, category, price, image_url, additional_images, stock_quantity, sizes, colors, variants, discount_type, discount_value, discount_start_date, discount_end_date, original_price, is_active, archived_at, created_at, updated_at';

export interface StorefrontProductsPage {
  products: Product[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const STOREFRONT_PRODUCTS_CHANGED = 'storefront:products-changed';

const ACTIVE_PRODUCTS_FILTER = 'is_active.eq.true,is_active.is.null';

export interface StorefrontBundleCache {
  store?: Record<string, unknown>;
  categories?: Record<string, unknown>[];
  products?: Product[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

const bundleMemoryKey = (slug: string) => `storefront-bundle:${slug}`;

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
    return {
      store: data.store as Record<string, unknown>,
      categories: (data.categories as Record<string, unknown>[]) || [],
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
  const cached = cache.get<StorefrontBundleCache>(key);
  if (cached?.store) return cached;

  return dedup(key, async () => {
    const edge = await fetchStorefrontBundleViaEdge(normalized, options);
    if (edge) {
      const payload: StorefrontBundleCache = {
        store: edge.storeInfo,
        categories: edge.categories,
        products: edge.products,
        nextCursor: edge.nextCursor,
        hasMore: edge.hasMore,
      };
      cache.set(key, payload, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
      return payload;
    }

    const rpc = await fetchStorefrontBundleRpc(normalized, options);
    if (rpc) {
      cache.set(key, rpc, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
    }
    return rpc;
  });
}

export async function resolveStoreOwnerBySlug(slug: string): Promise<string | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;

  try {
    const { data: meta, error } = await (supabase as any).rpc('get_store_meta', { p_slug: normalized });
    if (!error && meta?.store?.owner_id) {
      return String(meta.store.owner_id);
    }
  } catch {
    /* RPC may be unavailable */
  }

  const { data: settings } = await supabase
    .from('store_settings')
    .select('owner_id')
    .ilike('store_slug', normalized)
    .maybeSingle();

  if (settings?.owner_id) return settings.owner_id;

  try {
    const { data: storeRow } = await (supabase as any)
      .from('stores')
      .select('user_id')
      .ilike('store_slug', normalized)
      .maybeSingle();
    if (storeRow?.user_id) return storeRow.user_id as string;
  } catch {
    /* stores table may not exist in older DBs */
  }

  return null;
}

export async function resolveStoreSlugByOwnerId(ownerId: string): Promise<string | null> {
  if (!ownerId) return null;

  const { data: settings } = await supabase
    .from('store_settings')
    .select('store_slug')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (settings?.store_slug?.trim()) {
    return settings.store_slug.trim().toLowerCase();
  }

  try {
    const { data: storeRow } = await (supabase as any)
      .from('stores')
      .select('store_slug')
      .eq('user_id', ownerId)
      .maybeSingle();
    if (storeRow?.store_slug?.trim()) {
      return String(storeRow.store_slug).trim().toLowerCase();
    }
  } catch {
    /* stores table may not exist in older DBs */
  }

  return null;
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

  let { data, error } = await runQuery(MERCHANT_PRODUCTS_LIST_SELECT, true);
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

  let { data, error } = await runQuery(MERCHANT_PRODUCTS_LIST_SELECT, true);

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

  const dedupeKey = `storefront-page:${normalized}:${cursor}:${category}:${search}:${limit}`;

  return dedup(dedupeKey, async () => {
    const isFirstPage = !cursor && !category && !search;

    if (isFirstPage) {
      const bundle = peekStorefrontBundle(normalized) ?? (await loadStorefrontBundle(normalized, options));
      if (bundle?.products) {
        return {
          products: bundle.products,
          nextCursor: bundle.nextCursor ?? null,
          hasMore: !!bundle.hasMore,
        };
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

    const page = await fetchStorefrontProductsPage(normalized, { limit: 48 });
    const fromPage = page.products.find((p) => p.id === id);
    if (fromPage) return fromPage;

    const ownerId = await resolveStoreOwnerBySlug(normalized);
    if (ownerId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id === ownerId) {
        let { data: row, error: queryError } = await supabase
          .from('products')
          .select(MERCHANT_PRODUCTS_LIST_SELECT)
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

    const catalog = await fetchProductsViaSlugRpc(normalized);
    return catalog.find((p) => p.id === id) ?? null;
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
    /* fall through to per-id RPC */
  }

  await Promise.all(
    uniqueIds.map(async (id) => {
      if (map.has(id)) return;
      const product = await fetchStorefrontProductById(normalized, id);
      if (product && isStorefrontVisible(product)) {
        map.set(id, product);
      }
    })
  );

  return map;
}

/** Batch product fetch for checkout validation on tenant storefronts. */
export async function fetchStorefrontProductsByIds(
  slug: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  const map = new Map<string, Product>();
  if (uniqueIds.length === 0) return map;

  const normalized = slug.trim().toLowerCase();
  const idSet = new Set(uniqueIds);

  const catalog = await fetchProductsViaSlugRpc(normalized);
  for (const product of catalog) {
    if (idSet.has(product.id)) map.set(product.id, product);
  }

  const missing = uniqueIds.filter((id) => !map.has(id));
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (id) => {
        const product = await fetchStorefrontProductById(normalized, id);
        if (product) map.set(id, product);
      })
    );
  }

  return map;
}

export async function invalidateStorefrontForOwner(ownerId: string): Promise<void> {
  const { data } = await supabase
    .from('store_settings')
    .select('store_slug')
    .eq('owner_id', ownerId)
    .maybeSingle();

  let slug = data?.store_slug?.trim().toLowerCase();

  if (!slug) {
    try {
      const { data: storeRow } = await (supabase as any)
        .from('stores')
        .select('store_slug')
        .eq('user_id', ownerId)
        .maybeSingle();
      slug = storeRow?.store_slug?.trim().toLowerCase();
    } catch {
      /* stores table may not exist */
    }
  }

  if (slug) {
    cache.del(`storefront-bundle:${slug}`);
    cache.flushByPrefix(`tenant-products:${slug}`);
    cache.flushByPrefix(`tenant-meta:${slug}`);
    cache.flushByPrefix(`edge-bundle:${slug}`);
    cache.flushByPrefix(`edge-page:${slug}`);
    cache.flushByPrefix(`storefront-page:${slug}:`);
  } else {
    cache.flushByPrefix(`tenant-products:${ownerId}`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(STOREFRONT_PRODUCTS_CHANGED, { detail: { ownerId, slug } })
    );
    try {
      localStorage.setItem(
        'storefront:invalidate',
        JSON.stringify({ ownerId, slug, at: Date.now() })
      );
    } catch {
      /* ignore quota */
    }
  }
}

