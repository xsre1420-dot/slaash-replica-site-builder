
import { Product, Category } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { cache, CacheKeys, CacheTTL, dedup } from "@/lib/cache";
import { mapDbProduct } from "@/mappers/productMapper";
import { PRODUCT_DETAIL_SELECT, mergeProductForUpdate, productToDbRow } from "@/lib/productUpdateUtils";

/** @deprecated Use `@/services/productService` for new imports. */

// --- Internal owner / store helpers ---

let _currentOwnerId: string | null = null;
let _currentStoreId: string | null = null;

export const setCurrentOwner = (ownerId: string | null) => {
  _currentOwnerId = ownerId;
};

export const setCurrentStore = (storeId: string | null) => {
  _currentStoreId = storeId;
};

export const getCurrentStoreId = (): string | null => _currentStoreId;

const getOwnerId = (): string | null => _currentOwnerId;

// --- Categories ---

const getAuthOwnerId = async (): Promise<string | null> => {
  if (_currentOwnerId) return _currentOwnerId;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
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

export { OWNER_PRODUCTS_PAGE_SIZE as PRODUCTS_PAGE_SIZE } from '@/constants/pagination';

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

  if (!force) {
    const cached = cache.get<ProductsPageResult>(key);
    if (cached) return cached;
  }

  return dedup(key, async () => {
    try {
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_owner_products_page', {
        p_owner_id: ownerId,
        p_limit: pageSize,
        p_offset: page * pageSize,
        p_search: search || null,
        p_category: category && category !== 'all' ? category : null,
      });

      if (!rpcError && rpcData?.products) {
        const products = (rpcData.products as Record<string, unknown>[]).map((row) => mapDbProduct(row));
        const result: ProductsPageResult = {
          products,
          hasMore: !!rpcData.has_more,
          total: Number(rpcData.total) || products.length,
        };
        cache.set(key, result, CacheTTL.MEDIUM, CacheTTL.STALE);
        if (page === 0) {
          cache.set(CacheKeys.products(ownerId), products, CacheTTL.MEDIUM, CacheTTL.STALE);
          products_list = products;
        }
        return result;
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('products')
        .select('id, name, description, short_description, category, price, cost, original_price, image_url, additional_images, stock_quantity, sizes, colors, variants, is_active, sku, seo_title, seo_description, product_slug, tags, low_stock_threshold, min_stock_level, created_at, updated_at', { count: 'exact' })
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      if (search?.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error loading products page:', error);
        return cache.get<ProductsPageResult>(key) || { products: [], hasMore: false, total: 0 };
      }

      const products = data?.map((row) => mapDbProduct(row as Record<string, unknown>)) || [];
      const total = count ?? products.length;
      const result: ProductsPageResult = {
        products,
        hasMore: from + products.length < total,
        total,
      };
      cache.set(key, result, CacheTTL.MEDIUM, CacheTTL.STALE);
      if (page === 0) {
        cache.set(CacheKeys.products(ownerId), products, CacheTTL.MEDIUM, CacheTTL.STALE);
        products_list = products;
      }
      return result;
    } catch (error) {
      console.error('Error loading products page:', error);
      return cache.get<ProductsPageResult>(key) || { products: [], hasMore: false, total: 0 };
    }
  });
};

let products_list: Product[] = [];

export const loadProducts = async (force = false): Promise<Product[]> => {
  const { products } = await loadProductsPage(0, PRODUCTS_PAGE_SIZE, force);
  return products;
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

export const invalidateProducts = () => {
  cache.flushByPrefix('products:');
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
  const updated = [formatted, ...cached].slice(0, PRODUCTS_PAGE_SIZE);
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

export const addProduct = async (product: Product): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        description: product.description,
        short_description: product.shortDescription || null,
        category: product.category,
        price: product.price,
        cost: product.cost || null,
        original_price: product.originalPrice || null,
        image_url: product.image,
        additional_images: product.additionalImages || [],
        stock_quantity: product.stockQuantity ?? null,
        colors: product.colors ? JSON.parse(JSON.stringify(product.colors)) : null,
        sizes: product.sizes || null,
        variants: product.variants ? JSON.parse(JSON.stringify(product.variants)) : null,
        sku: product.sku || null,
        seo_title: product.seoTitle || null,
        seo_description: product.seoDescription || null,
        product_slug: product.productSlug || null,
        tags: product.tags?.length ? product.tags : [],
        low_stock_threshold: product.lowStockThreshold ?? 3,
        min_stock_level: product.lowStockThreshold ?? 3,
        is_active: product.isActive !== false,
        owner_id: user.id,
        store_id: _currentStoreId || undefined,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    if (data) {
      const key = CacheKeys.products(user.id);
      const current = cache.get<Product[]>(key) || [];
      cache.set(key, [mapDbProduct(data as Record<string, unknown>), ...current], CacheTTL.MEDIUM, CacheTTL.STALE);
      products = cache.get<Product[]>(key) || [];
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to add product' };
  }
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

    if (fetchError) return { success: false, error: fetchError.message };
    if (!existingRow) return { success: false, error: 'Product not found' };

    const existing = mapDbProduct(existingRow as Record<string, unknown>);
    const merged = mergeProductForUpdate(existing, updatedProduct);

    let updateQuery = supabase
      .from('products')
      .update(productToDbRow(merged))
      .eq('id', productId)
      .eq('owner_id', user.id);

    if (_currentStoreId) {
      updateQuery = updateQuery.eq('store_id', _currentStoreId);
    }

    const { data, error } = await updateQuery.select(PRODUCT_DETAIL_SELECT).single();

    if (error) return { success: false, error: error.message };

    const saved = mapDbProduct(data as Record<string, unknown>);
    const key = CacheKeys.products(getOwnerId() || user.id);
    const current = cache.get<Product[]>(key) || [];
    const inCache = current.some((p) => p.id === productId);
    cache.set(
      key,
      inCache ? current.map((p) => (p.id === productId ? saved : p)) : [saved, ...current],
      CacheTTL.MEDIUM,
      CacheTTL.STALE
    );
    products = cache.get<Product[]>(key) || [];

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update product' };
  }
};

export const deleteProduct = async (productId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    let deleteQuery = supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('owner_id', user.id);

    if (_currentStoreId) {
      deleteQuery = deleteQuery.eq('store_id', _currentStoreId);
    }

    const { error } = await deleteQuery;

    if (error) return { success: false, error: error.message };

    const key = CacheKeys.products(getOwnerId());
    const current = cache.get<Product[]>(key) || [];
    cache.set(key, current.filter(p => p.id !== productId), CacheTTL.MEDIUM, CacheTTL.STALE);
    products = cache.get<Product[]>(key) || [];

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete product' };
  }
};

// --- Product Queries (from cache) ---

export const getProductsByCategory = (categoryId: string): Product[] => {
  const all = cache.get<Product[]>(CacheKeys.products(getOwnerId())) || [];
  if (categoryId === "all") return all;
  return all.filter(product => product.category === categoryId);
};

export const getProductById = (id: string): Product | undefined => {
  const all = cache.get<Product[]>(CacheKeys.products(getOwnerId())) || [];
  return all.find(product => product.id === id);
};

/** Fetch product from DB — always reads fresh row for edit/detail reliability */
export const fetchProductById = async (productId: string): Promise<Product | null> => {
  const ownerId = await getAuthOwnerId();
  if (!ownerId) return null;

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_DETAIL_SELECT)
    .eq('id', productId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error || !data) return null;

  const product = mapDbProduct(data as Record<string, unknown>);
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
