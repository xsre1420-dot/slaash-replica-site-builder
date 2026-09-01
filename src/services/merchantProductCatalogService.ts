/**
 * Merchant product catalog — reads, cache, pagination, categories.
 * Import via `@/services/productService`.
 */
import { Product, Category } from '@/types';
import { callReadRpc } from '@/lib/readWrite/readClient';
import { supabase } from '@/integrations/supabase/client';
import { getAuthenticatedUserId } from '@/lib/authSession';
import { enqueueCacheInvalidation, enqueueCacheInvalidationForOwner } from '@/background/enqueue';
import { markLocalStorefrontMutation } from '@/lib/localMutationGuard';
import { patchStorefrontProductFromOwner } from '@/services/storefrontCacheService';
import { flushStorefrontProductDetail } from '@/services/storefrontCacheTiers';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { mapDbProduct, safeMapDbProduct } from '@/mappers/productMapper';
import {
  PRODUCT_DETAIL_SELECT,
  MERCHANT_PRODUCTS_LIST_SELECT,
  MERCHANT_PRODUCTS_STANDARD_SELECT,
  PRODUCT_MINIMAL_SELECT,
  merchantProductSelectForProfile,
  type MerchantProductSelectProfile,
  isSchemaColumnError,
} from '@/lib/productUpdateUtils';
import { OWNER_PRODUCTS_PAGE_SIZE } from '@/constants/pagination';

/** RPC grid profile omits short_description until DB migration; one batched backfill. */
const enrichListingShortDescriptions = async (products: Product[]): Promise<Product[]> => {
  if (products.length === 0 || products.every((p) => p.shortDescription?.trim())) {
    return products;
  }
  const ids = products.map((p) => p.id);
  const { data, error } = await supabase.from('products').select('id, short_description').in('id', ids);
  if (error || !data?.length) return products;
  const byId = new Map(
    data.map((row) => [String(row.id), (row.short_description as string | null)?.trim() || ''])
  );
  return products.map((p) => {
    const short = byId.get(p.id);
    return short && !p.shortDescription?.trim() ? { ...p, shortDescription: short } : p;
  });
};

// --- Internal owner / store helpers ---

let _currentOwnerId: string | null = null;
let _currentStoreId: string | null = null;

export const setCurrentOwner = (ownerId: string | null) => {
  if (ownerId !== _currentOwnerId) {
    _currentStoreId = null;
  }
  _currentOwnerId = ownerId;
};

export const setCurrentStore = (storeId: string | null) => {
  _currentStoreId = storeId;
};

export const getCurrentStoreId = (): string | null => _currentStoreId;

const getOwnerId = (): string | null => _currentOwnerId;

import { invalidateDashboardCaches } from '@/lib/cache/cacheInvalidation';

/** Keep merchant + storefront product caches consistent after mutations */
export const syncMerchantProductCatalog = (
  ownerId: string,
  row?: Record<string, unknown>,
  options?: { refreshStats?: boolean }
) => {
  cache.del(CacheKeys.products(ownerId));
  cache.del(CacheKeys.inventoryPage(ownerId));
  clearInflight(CacheKeys.inventoryPage(ownerId));
  cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
  clearInflight(`${CacheKeys.products(ownerId)}:p0:s:c`);
  if (options?.refreshStats !== false) {
    cache.flushByPrefix(`stats:${ownerId}:`);
    invalidateDashboardCaches(ownerId);
  }

  const affectsStorefront = !row || isStorefrontVisible(mapDbProduct(row));
  if (affectsStorefront) {
    markLocalStorefrontMutation(ownerId);
    if (row?.id) {
      const store = cache.get<{ store_slug?: string }>(CacheKeys.store(ownerId));
      const slug = store?.store_slug?.trim().toLowerCase();
      if (slug) {
        flushStorefrontProductDetail(slug, String(row.id));
      }
    }
    enqueueCacheInvalidationForOwner(ownerId);
  }

  if (row) appendCachedProduct(ownerId, row);
};

/** Lighter stock sync after inventory restock — avoids full catalog cache wipe */
export const patchMerchantStockInCache = (
  ownerId: string,
  productId: string,
  stockQuantity: number
): void => {
  const key = CacheKeys.products(ownerId);
  const inventoryKey = CacheKeys.inventoryPage(ownerId);
  const cached = cache.get<Product[]>(key);
  if (cached) {
    const updated = cached.map((p) =>
      p.id === productId ? { ...p, stockQuantity } : p
    );
    cache.set(key, updated, CacheTTL.MEDIUM, CacheTTL.STALE);
    syncModuleProductsMirror(updated);
  }
  const inventoryBundle = cache.get<{ products: Product[] }>(inventoryKey);
  if (inventoryBundle?.products) {
    cache.set(
      inventoryKey,
      {
        ...inventoryBundle,
        products: inventoryBundle.products.map((p) =>
          p.id === productId ? { ...p, stockQuantity } : p
        ),
      },
      CacheTTL.MEDIUM,
      CacheTTL.STALE
    );
  }
  clearInflight(inventoryKey);
  cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
  markLocalStorefrontMutation(ownerId);
  void patchStorefrontProductFromOwner(ownerId, productId, { stockQuantity });
};

// --- Categories ---

const getAuthOwnerId = async (): Promise<string | null> => {
  const sessionOwnerId = await getAuthenticatedUserId();
  if (sessionOwnerId) {
    if (_currentOwnerId && _currentOwnerId !== sessionOwnerId) {
      console.warn('[products] owner context mismatch — using session user');
    }
    return sessionOwnerId;
  }
  return _currentOwnerId;
};

export const getCategories = async (force = false): Promise<Category[]> => {
  const ownerId = await getAuthOwnerId();
  if (!ownerId) return [];

  const key = CacheKeys.categories(ownerId);

  if (!force) {
    const cached = cache.get<Category[]>(key);
    if (cached) return cached;
  }

  return dedup(key, async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, display_order')
        .eq('owner_id', ownerId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error loading categories:', error);
        return cache.get<Category[]>(key) || [];
      }

      const categories = data?.map(cat => ({
        id: cat.id,
        name: cat.name,
        order: cat.display_order || 0
      })) || [];

      cache.set(key, categories, CacheTTL.LONG, CacheTTL.STALE);
      return categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      return cache.get<Category[]>(key) || [];
    }
  });
};

export const getCategoriesSync = (): Category[] => {
  const ownerId = getOwnerId();
  if (!ownerId) return [];
  return cache.get<Category[]>(CacheKeys.categories(ownerId)) || [];
};

// --- Products ---

export const PRODUCTS_PAGE_SIZE = OWNER_PRODUCTS_PAGE_SIZE;

export interface ProductsPageResult {
  products: Product[];
  hasMore: boolean;
  total: number;
  nextCursor?: string | null;
}

export const loadProductsPage = async (
  page = 0,
  pageSize = PRODUCTS_PAGE_SIZE,
  force = false,
  search?: string,
  category?: string,
  profile: MerchantProductSelectProfile = 'grid',
  cursor?: string | null
): Promise<ProductsPageResult> => {
  const ownerId = await getAuthOwnerId();
  if (!ownerId) return { products: [], hasMore: false, total: 0 };

  const pageKey = cursor ? `k:${cursor}` : `p:${page}`;
  const key = `${CacheKeys.products(ownerId)}:${pageKey}:s${search || ''}:c${category || ''}:v${profile}`;

  if (force) {
    cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
    clearInflight(key);
  } else {
    const cached = cache.get<ProductsPageResult>(key);
    if (cached) return cached;
  }

  return dedup(key, async () => {
    try {
      const useRpcResult = (products: Product[], total: number, hasMore: boolean, nextCursor?: string | null) => {
        const result: ProductsPageResult = { products, hasMore, total, nextCursor };
        cache.set(key, result, CacheTTL.MEDIUM, CacheTTL.STALE);
        if (page === 0) {
          cache.set(CacheKeys.products(ownerId), products, CacheTTL.MEDIUM, CacheTTL.STALE);
          syncModuleProductsMirror(products);
        }
        return result;
      };

      const { data: rpcData, error: rpcError } = await callReadRpc<Record<string, unknown>>('get_owner_products_page', {
        p_owner_id: ownerId,
        p_limit: pageSize,
        p_offset: cursor ? 0 : page * pageSize,
        p_search: search || null,
        p_category: category && category !== 'all' ? category : null,
        p_profile: profile,
        p_cursor: cursor || null,
      });

      if (!rpcError && rpcData?.products) {
        const rpcProducts = ((rpcData.products as Record<string, unknown>[]) || [])
          .map((row) => safeMapDbProduct(row))
          .filter((p): p is Product => p != null);
        let rpcTotal = rpcData.total != null ? Number(rpcData.total) : undefined;
        if (rpcTotal == null && cursor) {
          const page0Key = `${CacheKeys.products(ownerId)}:p:0:s${search || ''}:c${category || ''}:v${profile}`;
          const page0 = cache.get<ProductsPageResult>(page0Key);
          if (page0) rpcTotal = page0.total;
        }
        rpcTotal = rpcTotal ?? rpcProducts.length;
        const hasFilters = !!(search?.trim() || (category && category !== 'all'));
        if (rpcProducts.length > 0 || rpcTotal > 0 || page > 0 || hasFilters) {
          const enriched =
            profile === 'grid' ? await enrichListingShortDescriptions(rpcProducts) : rpcProducts;
          return useRpcResult(enriched, rpcTotal, !!rpcData.has_more, rpcData.next_cursor ?? null);
        }
        console.warn('[products] RPC returned empty list, falling back to direct query');
      } else if (rpcError) {
        console.warn('[products] RPC failed, falling back to direct query:', rpcError.message);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const runDirectQuery = async (selectColumns: string) => {
        let query = supabase
          .from('products')
          .select(selectColumns, { count: 'exact' })
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (category && category !== 'all') {
          query = query.eq('category', category);
        }
        if (search?.trim()) {
          query = query.ilike('name', `%${search.trim()}%`);
        }

        return query;
      };

      const listSelect = merchantProductSelectForProfile(profile);
      let { data, error, count } = await runDirectQuery(listSelect);

      if (error && isSchemaColumnError(error.message) && profile !== 'full') {
        console.warn('[products] profile select failed, using full columns:', error.message);
        ({ data, error, count } = await runDirectQuery(MERCHANT_PRODUCTS_LIST_SELECT));
      }

      if (error && isSchemaColumnError(error.message)) {
        console.warn('[products] extended select failed, using standard columns:', error.message);
        ({ data, error, count } = await runDirectQuery(MERCHANT_PRODUCTS_STANDARD_SELECT));
      }

      if (error && isSchemaColumnError(error.message)) {
        console.warn('[products] standard select failed, using minimal columns:', error.message);
        ({ data, error, count } = await runDirectQuery(PRODUCT_MINIMAL_SELECT));
      }

      if (error) {
        console.error('Error loading products page:', error);
        return cache.get<ProductsPageResult>(key) || { products: [], hasMore: false, total: 0 };
      }

      const products =
        data
          ?.map((row) => safeMapDbProduct(row as Record<string, unknown>))
          .filter((p): p is Product => p != null) || [];
      const total = count ?? products.length;
      return useRpcResult(products, total, from + products.length < total);
    } catch (error) {
      console.error('Error loading products page:', error);
      return cache.get<ProductsPageResult>(key) || { products: [], hasMore: false, total: 0 };
    }
  });
};

let products_list: Product[] = [];

/** Keep legacy module mirrors aligned with the canonical cache entry */
const syncModuleProductsMirror = (items: Product[]) => {
  products_list = items;
  products = items;
};

/** First page only — warm-start cache mirror (never the full catalog). */
export const getProductsSync = (): Product[] => {
  const ownerId = getOwnerId();
  if (!ownerId) return [];
  return cache.get<Product[]>(CacheKeys.products(ownerId)) || [];
};

/** @deprecated Legacy module mirror — first page cache only */
export let products: Product[] = [];

// --- Cache Invalidation (scoped — preserves tenant/public cache) ---

export const invalidateOwnerCache = (ownerId?: string | null) => {
  if (ownerId) {
    cache.flushByPrefix(`products:${ownerId}`);
    cache.flushByPrefix(`categories:${ownerId}`);
    cache.del(CacheKeys.storeSettings(ownerId));
    cache.del(CacheKeys.store(ownerId));
    cache.flushByPrefix(`orders:${ownerId}`);
    cache.flushByPrefix(`stats:${ownerId}`);
  } else {
    invalidateProducts();
    invalidateCategories();
    cache.flushByPrefix('store_settings:');
    cache.flushByPrefix('store:');
    cache.flushByPrefix('orders:');
    cache.flushByPrefix('stats:');
  }
};

/** @deprecated Use invalidateOwnerCache */
export const invalidateCache = (ownerId?: string | null) => {
  invalidateOwnerCache(ownerId);
};

export const invalidateProducts = async () => {
  cache.flushByPrefix('products:');
  const ownerId = await getAuthOwnerId();
  if (ownerId) {
    clearInflight(`${CacheKeys.products(ownerId)}:p0:s:c`);
    cache.del(CacheKeys.previewStorePage(ownerId));
    clearInflight(CacheKeys.previewStorePage(ownerId));
    cache.del(CacheKeys.inventoryPage(ownerId));
    clearInflight(CacheKeys.inventoryPage(ownerId));
    cache.flushByPrefix(`edit-product-page:${ownerId}:`);
    cache.flushByPrefix(`product-reviews-page:${ownerId}:`);
    cache.flushByPrefix(`product-detail-page:o:${ownerId}:`);
    enqueueCacheInvalidationForOwner(ownerId);
  }
};

export const invalidateCategories = () => {
  cache.flushByPrefix('categories:');
};

/** Patch a single product in cache after realtime UPDATE (avoids full catalog reload) */
export const appendCachedProduct = (ownerId: string, row: Record<string, unknown>): boolean => {
  const key = CacheKeys.products(ownerId);
  const cached = cache.get<Product[]>(key);
  const formatted = mapDbProduct(row);
  if (!cached) {
    cache.set(key, [formatted], CacheTTL.MEDIUM, CacheTTL.STALE);
    products_list = [formatted];
    return true;
  }
  if (cached.some((p) => p.id === formatted.id)) return patchCachedProduct(ownerId, row);
  const updated = [formatted, ...cached];
  cache.set(key, updated, CacheTTL.MEDIUM, CacheTTL.STALE);
  products_list = updated;
  return true;
};

export const patchCachedProduct = (ownerId: string, row: Record<string, unknown>): boolean => {
  const key = CacheKeys.products(ownerId);
  const cached = cache.get<Product[]>(key);
  if (!cached) return false;
  const updated = cached.map((p) => (p.id === row.id ? mapDbProduct(row) : p));
  cache.set(key, updated, CacheTTL.MEDIUM, CacheTTL.STALE);
  syncModuleProductsMirror(updated);
  return true;
};

export const removeCachedProduct = (ownerId: string, productId: string): boolean => {
  const key = CacheKeys.products(ownerId);
  const cached = cache.get<Product[]>(key);
  if (!cached) return false;
  const updated = cached.filter((p) => p.id !== productId);
  cache.set(key, updated, CacheTTL.MEDIUM, CacheTTL.STALE);
  syncModuleProductsMirror(updated);
  return true;
};

// --- Product Queries (from first-page cache or single-product fetch) ---

export const getProductById = (id: string): Product | undefined => {
  const all = cache.get<Product[]>(CacheKeys.products(getOwnerId())) || [];
  return all.find(product => product.id === id);
};

const fetchProductRowById = async (
  productId: string,
  ownerId: string
): Promise<Record<string, unknown> | null> => {
  const selects = [PRODUCT_DETAIL_SELECT, MERCHANT_PRODUCTS_STANDARD_SELECT, PRODUCT_MINIMAL_SELECT];

  for (const selectColumns of selects) {
    const { data, error } = await supabase
      .from('products')
      .select(selectColumns)
      .eq('id', productId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!error && data) return data as Record<string, unknown>;
    if (error && !isSchemaColumnError(error.message)) {
      console.error('[products] fetchProductById failed:', error.message);
      return null;
    }
    if (error) {
      console.warn('[products] fetchProductById retry:', error.message);
    }
  }

  return null;
};

/** Fetch product from DB — always reads fresh row for edit/detail reliability */
export const fetchProductById = async (productId: string): Promise<Product | null> => {
  const ownerId = await getAuthOwnerId();
  if (!ownerId) return null;

  try {
    const { data, error } = await callReadRpc<Record<string, unknown>>('get_merchant_product_by_id', {
      p_product_id: productId,
    });
    if (!error && data) {
      const product = mapDbProduct(data as Record<string, unknown>);
      patchProductInCaches(ownerId, product);
      return product;
    }
  } catch {
    /* RPC fallback below */
  }

  const data = await fetchProductRowById(productId, ownerId);
  if (!data) return null;

  const product = mapDbProduct(data);
  patchProductInCaches(ownerId, product);
  return product;
};

const patchProductInCaches = (ownerId: string, product: Product) => {
  const key = CacheKeys.products(ownerId);
  const current = cache.get<Product[]>(key) || [];
  cache.set(
    key,
    current.some((p) => p.id === product.id)
      ? current.map((p) => (p.id === product.id ? product : p))
      : [product, ...current],
    CacheTTL.MEDIUM,
    CacheTTL.STALE
  );
  products_list = cache.get<Product[]>(key) || [product];
  products = products_list;
};

// --- Category CRUD ---

export const addCategory = async (category: Category): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('categories')
      .insert({ name: category.name, display_order: category.order || 0, owner_id: user.id })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    if (data) {
      const key = CacheKeys.categories(user.id);
      const current = cache.get<Category[]>(key) || [];
      cache.set(key, [...current, { id: data.id, name: data.name, order: data.display_order }], CacheTTL.MEDIUM, CacheTTL.STALE);
    }
    enqueueCacheInvalidation(user.id, 'categories');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to add category' };
  }
};

export const updateCategory = async (categoryId: string, updatedCategory: Category): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const key = CacheKeys.categories(getOwnerId());
    const previous = (cache.get<Category[]>(key) || []).find((c) => c.id === categoryId);
    const previousName = previous?.name;

    const { error } = await supabase
      .from('categories')
      .update({ name: updatedCategory.name, display_order: updatedCategory.order || 0 })
      .eq('id', categoryId)
      .eq('owner_id', user.id);

    if (error) return { success: false, error: error.message };

    if (previousName && previousName !== updatedCategory.name) {
      const { error: productsError } = await supabase
        .from('products')
        .update({ category: updatedCategory.name })
        .eq('owner_id', user.id)
        .eq('category', previousName);

      if (productsError) return { success: false, error: productsError.message };
      syncMerchantProductCatalog(user.id);
      enqueueCacheInvalidation(user.id, 'full');
    } else {
      const current = cache.get<Category[]>(key) || [];
      cache.set(key, current.map(c => c.id === categoryId ? { ...updatedCategory, id: categoryId } : c), CacheTTL.MEDIUM, CacheTTL.STALE);
      enqueueCacheInvalidation(user.id, 'categories');
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update category' };
  }
};

export const deleteCategory = async (categoryId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('owner_id', user.id);

    if (error) return { success: false, error: error.message };

    const key = CacheKeys.categories(getOwnerId());
    const current = cache.get<Category[]>(key) || [];
    cache.set(key, current.filter(c => c.id !== categoryId), CacheTTL.MEDIUM, CacheTTL.STALE);
    enqueueCacheInvalidation(user.id, 'categories');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete category' };
  }
};
