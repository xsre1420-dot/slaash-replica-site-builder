
import { Product, Category } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedUserId } from '@/lib/authSession';
import { runOncePerKey, type AddProductResult } from "@/lib/productCreateLock";
import { invalidateStorefrontForOwner } from "@/services/storefrontProductService";
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { mapDbProduct, safeMapDbProduct } from "@/mappers/productMapper";
import {
  PRODUCT_DETAIL_SELECT,
  PRODUCT_INSERT_RETURN_SELECT,
  MERCHANT_PRODUCTS_LIST_SELECT,
  MERCHANT_PRODUCTS_STANDARD_SELECT,
  PRODUCT_MINIMAL_SELECT,
  PRODUCT_INSERT_RETURN_MINIMAL,
  buildProductInsertPayload,
  isSchemaColumnError,
  mapProductInsertError,
  mergeProductForUpdate,
  productToDbRow,
} from "@/lib/productUpdateUtils";
import { OWNER_PRODUCTS_PAGE_SIZE } from '@/constants/pagination';

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
export const syncMerchantProductCatalog = (ownerId: string, row?: Record<string, unknown>) => {
  cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
  clearInflight(`${CacheKeys.products(ownerId)}:p0:s:c`);
  cache.flushByPrefix(`stats:${ownerId}:`);
  void invalidateStorefrontForOwner(ownerId);
  if (row) appendCachedProduct(ownerId, row);
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
}

export const loadProductsPage = async (
  page = 0,
  pageSize = PRODUCTS_PAGE_SIZE,
  force = false,
  search?: string,
  category?: string
): Promise<ProductsPageResult> => {
  const ownerId = await getAuthOwnerId();
  if (!ownerId) return { products: [], hasMore: false, total: 0 };

  const key = `${CacheKeys.products(ownerId)}:p${page}:s${search || ''}:c${category || ''}`;

  if (force) {
    cache.flushByPrefix(`${CacheKeys.products(ownerId)}:p`);
    clearInflight(key);
  } else {
    const cached = cache.get<ProductsPageResult>(key);
    if (cached) return cached;
  }

  return dedup(key, async () => {
    try {
      const useRpcResult = (products: Product[], total: number, hasMore: boolean) => {
        const result: ProductsPageResult = { products, hasMore, total };
        cache.set(key, result, CacheTTL.MEDIUM, CacheTTL.STALE);
        if (page === 0) {
          cache.set(CacheKeys.products(ownerId), products, CacheTTL.MEDIUM, CacheTTL.STALE);
          products_list = products;
        }
        return result;
      };

      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_owner_products_page', {
        p_owner_id: ownerId,
        p_limit: pageSize,
        p_offset: page * pageSize,
        p_search: search || null,
        p_category: category && category !== 'all' ? category : null,
      });

      if (!rpcError && rpcData?.products) {
        const rpcProducts = ((rpcData.products as Record<string, unknown>[]) || [])
          .map((row) => safeMapDbProduct(row))
          .filter((p): p is Product => p != null);
        const rpcTotal = Number(rpcData.total) || rpcProducts.length;
        const hasFilters = !!(search?.trim() || (category && category !== 'all'));
        if (rpcProducts.length > 0 || rpcTotal > 0 || page > 0 || hasFilters) {
          return useRpcResult(rpcProducts, rpcTotal, !!rpcData.has_more);
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

      let { data, error, count } = await runDirectQuery(MERCHANT_PRODUCTS_LIST_SELECT);

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

export const loadProducts = async (force = false): Promise<Product[]> => {
  const { products } = await loadAllMerchantProducts(force);
  return products;
};

/** Loads every merchant product page — used by Product Management & Inventory */
export const loadAllMerchantProducts = async (
  force = false
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
    const result = await loadProductsPage(page, pageSize, force);
    combined = page === 0 ? result.products : [...combined, ...result.products];
    total = result.total;
    hasMore = result.hasMore;
    page += 1;
  }

  const ownerId = await getAuthOwnerId();
  if (ownerId) {
    cache.set(CacheKeys.products(ownerId), combined, CacheTTL.MEDIUM, CacheTTL.STALE);
    products_list = combined;
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
  products_list = updated;
  products = updated;
  return true;
};

export const removeCachedProduct = (ownerId: string, productId: string): boolean => {
  const key = CacheKeys.products(ownerId);
  const cached = cache.get<Product[]>(key);
  if (!cached) return false;
  const updated = cached.filter((p) => p.id !== productId);
  cache.set(key, updated, CacheTTL.MEDIUM, CacheTTL.STALE);
  products = updated;
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
      const payloads = buildProductInsertPayload(product, userId, storeId);
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
        return { success: false, error: mapProductInsertError(error.message) };
      }

      if (data) {
        syncProductCachesAfterMutation(userId, data as Record<string, unknown>);

        const stockQty = product.stockQuantity ?? 0;
        if (stockQty > 0) {
          void (supabase as any).from('inventory_movements').insert({
            product_id: (data as Record<string, unknown>).id,
            owner_id: userId,
            quantity_delta: stockQty,
            reason: 'initial_stock',
          });
        }

        products = cache.get<Product[]>(CacheKeys.products(userId)) || [];
        products_list = products;
        return { success: true, productId: String((data as Record<string, unknown>).id) };
      }

      return { success: true };
    } catch (err) {
      console.error('[products] addProduct unexpected error:', err);
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

    let updateQuery = supabase
      .from('products')
      .update(productToDbRow(merged))
      .eq('id', productId)
      .eq('owner_id', user.id);

    const { data, error } = await updateQuery.select(PRODUCT_DETAIL_SELECT).single();

    if (error) return { success: false, error: error.message };

    syncProductCachesAfterMutation(user.id, data as Record<string, unknown>);
    products = cache.get<Product[]>(CacheKeys.products(user.id)) || [];

    return { success: true };
  } catch (err) {
    console.error('[products] updateProduct unexpected error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'فشل في تحديث المنتج' };
  }
};

export const deleteProduct = async (productId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('owner_id', user.id);

    if (error) return { success: false, error: error.message };

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

  const data = await fetchProductRowById(productId, ownerId);
  if (!data) return null;

  const product = mapDbProduct(data);
  const key = CacheKeys.products(ownerId);
  const current = cache.get<Product[]>(key) || [];
  cache.set(
    key,
    current.some((p) => p.id === productId)
      ? current.map((p) => (p.id === productId ? product : p))
      : [product, ...current],
    CacheTTL.MEDIUM,
    CacheTTL.STALE
  );
  products_list = cache.get<Product[]>(key) || [product];
  products = products_list;
  return product;
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
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to add category' };
  }
};

export const updateCategory = async (categoryId: string, updatedCategory: Category): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { error } = await supabase
      .from('categories')
      .update({ name: updatedCategory.name, display_order: updatedCategory.order || 0 })
      .eq('id', categoryId)
      .eq('owner_id', user.id);

    if (error) return { success: false, error: error.message };

    const key = CacheKeys.categories(getOwnerId());
    const current = cache.get<Category[]>(key) || [];
    cache.set(key, current.map(c => c.id === categoryId ? { ...updatedCategory, id: categoryId } : c), CacheTTL.MEDIUM, CacheTTL.STALE);
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
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete category' };
  }
};
