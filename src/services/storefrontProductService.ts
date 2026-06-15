/**
 * Storefront product reads — SECURITY DEFINER RPC first, safe fallbacks when RPC/slug lookup fails.
 */
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types';
import { mapStorefrontProduct } from '@/mappers/productMapper';
import {
  MERCHANT_PRODUCTS_LIST_SELECT,
  isSchemaColumnError,
} from '@/lib/productUpdateUtils';
import { cache } from '@/lib/cache';

const MINIMAL_STOREFRONT_SELECT =
  'id, name, description, category, price, image_url, additional_images, stock_quantity, is_active, created_at, updated_at';

export interface StorefrontProductsPage {
  products: Product[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const STOREFRONT_PRODUCTS_CHANGED = 'storefront:products-changed';

const ACTIVE_PRODUCTS_FILTER = 'is_active.eq.true,is_active.is.null';

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

async function queryActiveProductsByOwner(
  ownerId: string,
  options: { category?: string; search?: string; limit?: number } = {}
): Promise<Product[]> {
  const limit = options.limit ?? 48;

  const runQuery = async (select: string) => {
    let query = supabase
      .from('products')
      .select(select)
      .eq('owner_id', ownerId)
      .or(ACTIVE_PRODUCTS_FILTER)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options.category?.trim()) {
      query = query.eq('category', options.category.trim());
    }
    if (options.search?.trim()) {
      query = query.ilike('name', `%${options.search.trim()}%`);
    }

    return query;
  };

  let { data, error } = await runQuery(MERCHANT_PRODUCTS_LIST_SELECT);

  if (error && isSchemaColumnError(error.message)) {
    ({ data, error } = await runQuery(MINIMAL_STOREFRONT_SELECT));
  }

  if (error) {
    console.error('[storefront] direct product query failed:', error);
    return [];
  }

  return (data ?? []).map((row) => mapStorefrontProduct(row as Record<string, unknown>));
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

    return ((data as Record<string, unknown>[]) ?? []).map(mapStorefrontProduct);
  } catch (err) {
    console.warn('[storefront] get_store_products_by_slug unavailable:', err);
    return [];
  }
}

function applyClientFilters(
  products: Product[],
  options: { category?: string; search?: string; limit?: number }
): Product[] {
  let filtered = products;

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

  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return { products: [], nextCursor: null, hasMore: false };
  }

  try {
    const { data, error } = await (supabase as any).rpc('get_store_products_page', {
      p_slug: normalized,
      p_limit: limit,
      p_cursor: options.cursor || null,
      p_category: options.category?.trim() || null,
      p_search: options.search?.trim() || null,
    });

    if (!error && data?.products !== undefined) {
      const mapped = ((data.products as Record<string, unknown>[]) || []).map(mapStorefrontProduct);

      if (mapped.length > 0 || options.cursor) {
        return {
          products: mapped,
          nextCursor: data.next_cursor || null,
          hasMore: !!data.has_more,
        };
      }

      const ownerId = await resolveStoreOwnerBySlug(normalized);
      if (ownerId && !options.category?.trim() && !options.search?.trim()) {
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

  const slugRpcProducts = await fetchProductsViaSlugRpc(normalized);
  if (slugRpcProducts.length > 0) {
    const filtered = applyClientFilters(slugRpcProducts, {
      category: options.category,
      search: options.search,
      limit,
    });
    return { products: filtered, nextCursor: null, hasMore: false };
  }

  const ownerId = await resolveStoreOwnerBySlug(normalized);
  if (!ownerId) {
    return { products: [], nextCursor: null, hasMore: false };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === ownerId) {
    const products = await queryActiveProductsByOwner(ownerId, {
      category: options.category,
      search: options.search,
      limit,
    });
    return { products, nextCursor: null, hasMore: false };
  }

  return { products: [], nextCursor: null, hasMore: false };
}

/** Single product for storefront detail page — RPC + slug catalog fallback (works for anon). */
export async function fetchStorefrontProductById(
  slug: string,
  productId: string
): Promise<Product | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalized) || !productId?.trim()) return null;

  try {
    const { data, error } = await (supabase as any).rpc('get_store_product_by_id', {
      p_slug: normalized,
      p_product_id: productId,
    });

    if (!error && data) {
      return mapStorefrontProduct(data as Record<string, unknown>);
    }

    if (error) {
      console.warn('[storefront] get_store_product_by_id failed:', error.message);
    }
  } catch (err) {
    console.warn('[storefront] get_store_product_by_id unavailable:', err);
  }

  const ownerId = await resolveStoreOwnerBySlug(normalized);
  if (ownerId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id === ownerId) {
      let { data, error } = await supabase
        .from('products')
        .select(MERCHANT_PRODUCTS_LIST_SELECT)
        .eq('id', productId)
        .eq('owner_id', ownerId)
        .or(ACTIVE_PRODUCTS_FILTER)
        .maybeSingle();

      if (error && isSchemaColumnError(error.message)) {
        ({ data, error } = await supabase
          .from('products')
          .select(MINIMAL_STOREFRONT_SELECT)
          .eq('id', productId)
          .eq('owner_id', ownerId)
          .or(ACTIVE_PRODUCTS_FILTER)
          .maybeSingle());
      }

      if (data) return mapStorefrontProduct(data as Record<string, unknown>);
    }
  }

  const catalog = await fetchProductsViaSlugRpc(normalized);
  return catalog.find((p) => p.id === productId) ?? null;
}

/** Batch product fetch for checkout validation on tenant storefronts. */
export async function fetchStorefrontProductsByIds(
  slug: string,
  productIds: string[]
): Promise<Map<string, Product>> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  const map = new Map<string, Product>();
  if (uniqueIds.length === 0) return map;

  await Promise.all(
    uniqueIds.map(async (id) => {
      const product = await fetchStorefrontProductById(slug, id);
      if (product) map.set(id, product);
    })
  );

  return map;
}

export async function invalidateStorefrontForOwner(ownerId: string): Promise<void> {
  cache.flushByPrefix('tenant-products:');

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
    cache.flushByPrefix(`tenant-products:${slug}`);
    cache.flushByPrefix(`tenant-meta:${slug}`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(STOREFRONT_PRODUCTS_CHANGED, { detail: { ownerId, slug } })
    );
  }
}
