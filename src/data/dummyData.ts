/**
 * Merchant product catalog engine (cache, pagination, lifecycle, categories).
 * Import via `@/services/productService` — do not import this file directly.
 */
import { Product, Category } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedUserId } from '@/lib/authSession';
import { runOncePerKey, type AddProductResult } from "@/lib/productCreateLock";
import { invalidateStorefrontForOwner } from "@/services/storefrontProductService";
import { markLocalStorefrontMutation } from '@/lib/localMutationGuard';
import { patchStorefrontProductFromOwner } from '@/services/storefrontCacheService';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { mapDbProduct, safeMapDbProduct } from "@/mappers/productMapper";
import {
  PRODUCT_DETAIL_SELECT,
  PRODUCT_INSERT_RETURN_SELECT,
  MERCHANT_PRODUCTS_LIST_SELECT,
  MERCHANT_PRODUCTS_STANDARD_SELECT,
  PRODUCT_MINIMAL_SELECT,
  merchantProductSelectForProfile,
  type MerchantProductSelectProfile,
  PRODUCT_INSERT_RETURN_MINIMAL,
  buildProductInsertPayload,
  buildProductLifecyclePatch,
  buildProductUpdateAttempts,
  isSchemaColumnError,
  mapProductInsertError,
  mergeProductForUpdate,
  patchAffectsCatalogStats,
  productToDbRow,
  type ProductLifecycleAction,
} from "@/lib/productUpdateUtils";
import { OWNER_PRODUCTS_PAGE_SIZE } from '@/constants/pagination';
import {
  collectProductImageUrls,
  cleanupRemovedProductImages,
  deleteProductStorageImages,
} from '@/utils/productImageCleanup';
import { recordHealthEvent } from '@/lib/observability/healthMonitor';

/** @deprecated Use `@/services/productService` for new imports. */

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

const resolveStoreIdForOwner = async (ownerId: string): Promise<string | null> => {
  if (_currentStoreId && _currentOwnerId === ownerId) return _currentStoreId;

  try {
    const { data, error } = await (supabase as any).rpc('get_store_for_user', { p_user_id: ownerId });
    if (!error && data?.id) {
      _currentStoreId = data.id as string;
      return _currentStoreId;
    }
  } catch {
    /* RPC may be unavailable before migration */
  }

  const { data: storeRow } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', ownerId)
    .maybeSingle();

  if (storeRow?.id) {
    _currentStoreId = storeRow.id;
    return storeRow.id;
  }

  const { data: settings } = await supabase
    .from('store_settings')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (settings?.id) {
    _currentStoreId = settings.id;
    return settings.id;
  }

  return null;
};

/** Keep merchant + storefront product caches consistent after mutations */
export const syncMerchantProductCatalog = (
  ownerId: string,
  row?: Record<string, unknown>,
  options?: { refreshStats?: boolean }
) => {
  cache.del(CacheKeys.products(ownerId));
  cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
  clearInflight(`${CacheKeys.products(ownerId)}:p0:s:c`);
  if (options?.refreshStats !== false) {
    cache.flushByPrefix(`stats:${ownerId}:`);
  }

  const affectsStorefront = !row || isStorefrontVisible(mapDbProduct(row));
  if (affectsStorefront) {
    markLocalStorefrontMutation(ownerId);
    void invalidateStorefrontForOwner(ownerId);
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
  const cached = cache.get<Product[]>(key);
  if (cached) {
    const updated = cached.map((p) =>
      p.id === productId ? { ...p, stockQuantity } : p
    );
    cache.set(key, updated, CacheTTL.MEDIUM, CacheTTL.STALE);
    syncModuleProductsMirror(updated);
  }
  cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
  markLocalStorefrontMutation(ownerId);
  void patchStorefrontProductFromOwner(ownerId, productId, { stockQuantity });
};

const syncProductCachesAfterMutation = syncMerchantProductCatalog;

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

      cache.set(key, categories, CacheTTL.MEDIUM, CacheTTL.STALE);
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

      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_owner_products_page', {
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
        const rpcTotal = Number(rpcData.total) || rpcProducts.length;
        const hasFilters = !!(search?.trim() || (category && category !== 'all'));
        if (rpcProducts.length > 0 || rpcTotal > 0 || page > 0 || hasFilters) {
          return useRpcResult(rpcProducts, rpcTotal, !!rpcData.has_more, rpcData.next_cursor ?? null);
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

export const loadProducts = async (force = false): Promise<Product[]> => {
  const { products } = await loadAllMerchantProducts(force);
  return products;
};

/** Loads every merchant product page — prefer paginated loadProductsPage for UI */
export const loadAllMerchantProducts = async (
  force = false,
  profile: MerchantProductSelectProfile = 'grid'
): Promise<ProductsPageResult> => {
  const pageSize = PRODUCTS_PAGE_SIZE;
  let page = 0;
  let combined: Product[] = [];
  let total = 0;
  let hasMore = true;

  if (force) {
    const ownerId = await getAuthOwnerId();
    if (ownerId) {
      cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
      clearInflight(`${CacheKeys.products(ownerId)}:p0:s:c`);
    }
  }

  while (hasMore && page < 100) {
    const result = await loadProductsPage(page, pageSize, force, undefined, undefined, profile);
    combined = page === 0 ? result.products : [...combined, ...result.products];
    total = result.total;
    hasMore = result.hasMore;
    page += 1;
  }

  const ownerId = await getAuthOwnerId();
  if (ownerId) {
    cache.set(CacheKeys.products(ownerId), combined, CacheTTL.MEDIUM, CacheTTL.STALE);
    syncModuleProductsMirror(combined);
  }

  return { products: combined, hasMore: false, total: total || combined.length };
};

export const getProductsSync = (): Product[] => {
  const ownerId = getOwnerId();
  if (!ownerId) return [];
  return cache.get<Product[]>(CacheKeys.products(ownerId)) || [];
};

// Keep backward compat
export let products: Product[] = [];

export const reloadProducts = async (): Promise<void> => {
  const loaded = await loadProducts(true);
  products = loaded;
};

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

/** @deprecated Use invalidateOwnerCache — does NOT flush tenant storefront cache */
export const invalidateCache = (ownerId?: string | null) => {
  invalidateOwnerCache(ownerId);
};

export const invalidateProducts = async () => {
  cache.flushByPrefix('products:');
  const ownerId = await getAuthOwnerId();
  if (ownerId) {
    clearInflight(`${CacheKeys.products(ownerId)}:p0:s:c`);
    void invalidateStorefrontForOwner(ownerId);
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

// --- Product CRUD (optimistic + cache update) ---

export const addProduct = async (
  product: Product,
  options?: { idempotencyKey?: string }
): Promise<AddProductResult> => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false, error: 'يجب تسجيل الدخول أولاً' };

  if (!product.image?.trim() || product.image.startsWith('blob:')) {
    return { success: false, error: 'انتظر اكتمال رفع الصورة قبل الحفظ' };
  }

  const lockKey = `${userId}:${options?.idempotencyKey ?? product.name}:${product.image}`;

  return runOncePerKey(lockKey, async () => {
    try {
      const storeId = await resolveStoreIdForOwner(userId);
      const publishIntent = product.isActive !== false;
      const payloads = buildProductInsertPayload(
        publishIntent ? { ...product, isActive: true, archivedAt: null } : product,
        userId,
        storeId
      );
      const insertAttempts = [
        payloads.full,
        payloads.extended,
        payloads.standard,
        payloads.minimal,
      ];

      let data: Record<string, unknown> | null = null;
      let error: { message: string } | null = null;

      for (const row of insertAttempts) {
        const attempt = await supabase
          .from('products')
          .insert(row)
          .select(PRODUCT_INSERT_RETURN_MINIMAL)
          .single();

        data = attempt.data as Record<string, unknown> | null;
        error = attempt.error;

        if (!error) break;
        if (!isSchemaColumnError(error.message)) break;
        console.warn('[products] insert retry with fewer columns:', error.message);
      }

      if (error) {
        console.error('[products] insert failed:', error);
        recordHealthEvent('product.create', false, { message: error.message });
        return { success: false, error: mapProductInsertError(error.message) };
      }

      if (data) {
        let finalRow = data as Record<string, unknown>;
        const productId = String(finalRow.id);

        const stockQty = product.stockQuantity ?? 0;
        if (stockQty > 0) {
          const { data: stockData, error: stockError } = await (supabase as any).rpc(
            'record_product_initial_stock',
            {
              p_product_id: productId,
              p_owner_id: userId,
              p_quantity: stockQty,
            }
          );
          if (stockError || !stockData?.success) {
            console.warn('[products] initial_stock ledger failed:', stockError?.message ?? stockData?.error);
            await supabase.from('products').delete().eq('id', productId).eq('owner_id', userId);
            recordHealthEvent('product.create', false, { message: 'initial_stock_ledger_failed' });
            return {
              success: false,
              error: 'فشل تسجيل المخزون الافتتاحي — لم يتم إنشاء المنتج. حاول مرة أخرى.',
            };
          }
        }

        if (publishIntent && finalRow.is_active !== true) {
          let published = false;
          try {
            const { data: pubData, error: pubError } = await (supabase as any).rpc(
              'publish_owner_product',
              { p_product_id: productId }
            );
            if (!pubError && pubData?.success && pubData?.product) {
              finalRow = pubData.product as Record<string, unknown>;
              published = true;
            }
          } catch {
            /* publish RPC optional until migration applied */
          }

          if (!published) {
            const lifecycle = await setProductLifecycle(productId, 'publish');
            if (!lifecycle.success) {
              return {
                success: true,
                productId,
                error: lifecycle.error ?? 'تم إنشاء المنتج لكن فشل النشر',
              };
            }
          }
        }

        syncProductCachesAfterMutation(userId, finalRow);
        products = cache.get<Product[]>(CacheKeys.products(userId)) || [];
        products_list = products;
        recordHealthEvent('product.create', true);
        return { success: true, productId };
      }

      return { success: true };
    } catch (err) {
      console.error('[products] addProduct unexpected error:', err);
      recordHealthEvent('product.create', false, {
        message: err instanceof Error ? err.message : 'unknown',
      });
      return { success: false, error: err instanceof Error ? err.message : 'فشل في إضافة المنتج' };
    }
  });
};

export const updateProduct = async (productId: string, updatedProduct: Partial<Product>): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data: existingRow, error: fetchError } = await supabase
      .from('products')
      .select(PRODUCT_DETAIL_SELECT)
      .eq('id', productId)
      .eq('owner_id', user.id)
      .maybeSingle();

    let existingData = existingRow as Record<string, unknown> | null;
    if (fetchError && isSchemaColumnError(fetchError.message)) {
      existingData = await fetchProductRowById(productId, user.id);
    } else if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!existingData) return { success: false, error: 'Product not found' };

    const existing = mapDbProduct(existingData);
    const merged = mergeProductForUpdate(existing, updatedProduct);

    const selectAttempts = [
      PRODUCT_DETAIL_SELECT,
      MERCHANT_PRODUCTS_LIST_SELECT,
      MERCHANT_PRODUCTS_STANDARD_SELECT,
      PRODUCT_INSERT_RETURN_MINIMAL,
    ];

    let data: Record<string, unknown> | null = null;
    let lastError: string | null = null;

    for (const patch of buildProductUpdateAttempts(merged)) {
      for (const selectColumns of selectAttempts) {
        const { data: row, error } = await supabase
          .from('products')
          .update(patch)
          .eq('id', productId)
          .eq('owner_id', user.id)
          .select(selectColumns)
          .maybeSingle();

        if (!error && row) {
          data = row as Record<string, unknown>;
          lastError = null;
          break;
        }

        lastError = error?.message ?? lastError;
        if (error && !isSchemaColumnError(error.message)) break;
      }
      if (data) break;
    }

    if (!data) {
      return { success: false, error: lastError || 'فشل في تحديث المنتج' };
    }

    void cleanupRemovedProductImages(existingData, data);
    syncProductCachesAfterMutation(user.id, data, {
      refreshStats: patchAffectsCatalogStats(updatedProduct),
    });
    products = cache.get<Product[]>(CacheKeys.products(user.id)) || [];

    return { success: true };
  } catch (err) {
    console.error('[products] updateProduct unexpected error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'فشل في تحديث المنتج' };
  }
};

export const setProductLifecycle = async (
  productId: string,
  action: ProductLifecycleAction
): Promise<{ success: boolean; error?: string }> =>
  updateProduct(productId, buildProductLifecyclePatch(action));

export const publishProduct = async (productId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data, error } = await (supabase as any).rpc('publish_owner_product', {
      p_product_id: productId,
    });

    if (!error && data?.success && data?.product) {
      syncProductCachesAfterMutation(user.id, data.product as Record<string, unknown>);
      products = cache.get<Product[]>(CacheKeys.products(user.id)) || [];
      recordHealthEvent('product.publish', true);
      return { success: true };
    }
    recordHealthEvent('product.publish', false, { message: error?.message ?? 'rpc failed' });
  } catch {
    /* RPC optional until migration applied */
  }

  return setProductLifecycle(productId, 'publish');
};

export const deleteProduct = async (productId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data: row } = await supabase
      .from('products')
      .select('image_url, additional_images')
      .eq('id', productId)
      .eq('owner_id', user.id)
      .maybeSingle();

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('owner_id', user.id);

    if (error) return { success: false, error: error.message };

    if (row) {
      void deleteProductStorageImages(collectProductImageUrls(row));
    }

    removeCachedProduct(user.id, productId);
    syncMerchantProductCatalog(user.id);
    products = cache.get<Product[]>(CacheKeys.products(user.id)) || [];

    return { success: true };
  } catch (err) {
    console.error('[products] deleteProduct unexpected error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'فشل في حذف المنتج' };
  }
};

// --- Product Queries (from cache) ---

export const getProductsByCategory = (categoryKey: string): Product[] => {
  const ownerId = getOwnerId();
  const all = cache.get<Product[]>(CacheKeys.products(ownerId)) || [];
  if (categoryKey === "all") return all;
  const cats = cache.get<Category[]>(CacheKeys.categories(ownerId)) || [];
  const categoryName = cats.find((c) => c.id === categoryKey)?.name ?? categoryKey;
  return all.filter((product) => product.category === categoryName);
};

export const getProductById = (id: string): Product | undefined => {
  const all = cache.get<Product[]>(CacheKeys.products(getOwnerId())) || [];
  return all.find(product => product.id === id);
};

/** Fetch product row with progressive column fallback when migrations are pending */
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
    const { data, error } = await (supabase as any).rpc('get_merchant_product_by_id', {
      p_product_id: productId,
    });
    if (!error && data) {
      const product = mapDbProduct(data as Record<string, unknown>);
      patchProductInCaches(ownerId, product);
      return product;
    }
  } catch {
    /* RPC optional until migration applied */
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
    void invalidateStorefrontForOwner(user.id);
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
    }

    const current = cache.get<Category[]>(key) || [];
    cache.set(key, current.map(c => c.id === categoryId ? { ...updatedCategory, id: categoryId } : c), CacheTTL.MEDIUM, CacheTTL.STALE);
    void invalidateStorefrontForOwner(user.id);
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
    void invalidateStorefrontForOwner(user.id);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete category' };
  }
};
