
import { Product, Category, ColorOption, ProductVariant } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { cache, CacheKeys, CacheTTL, dedup } from "@/lib/cache";

// --- Formatters ---

const formatProduct = (product: any): Product => ({
  id: product.id,
  name: product.name,
  description: product.description || '',
  category: product.category,
  price: Number(product.price),
  cost: Number(product.cost) || undefined,
  image: product.image_url || '',
  additionalImages: product.additional_images || [],
  stockQuantity: product.stock_quantity ?? undefined,
  sizes: Array.isArray(product.sizes) ? product.sizes as string[] : undefined,
  colors: (() => {
    if (!product.colors) return undefined;
    if (typeof product.colors === 'string') {
      try { return JSON.parse(product.colors) as ColorOption[]; } catch { return undefined; }
    }
    if (Array.isArray(product.colors)) return product.colors as unknown as ColorOption[];
    return undefined;
  })(),
  variants: (() => {
    if (!product.variants) return undefined;
    if (typeof product.variants === 'string') {
      try { return JSON.parse(product.variants) as ProductVariant[]; } catch { return undefined; }
    }
    if (Array.isArray(product.variants)) return product.variants as unknown as ProductVariant[];
    return undefined;
  })(),
  discountType: product.discount_type as 'none' | 'percentage' | 'amount' | undefined,
  discountValue: product.discount_value ? Number(product.discount_value) : undefined,
  discountStartDate: product.discount_start_date || undefined,
  discountEndDate: product.discount_end_date || undefined,
  originalPrice: product.original_price ? Number(product.original_price) : undefined,
});

// --- Internal owner ID helper ---

let _currentOwnerId: string | null = null;

export const setCurrentOwner = (ownerId: string | null) => {
  _currentOwnerId = ownerId;
};

const getOwnerId = () => _currentOwnerId || 'anonymous';

// --- Categories ---

export const getCategories = async (force = false): Promise<Category[]> => {
  const key = CacheKeys.categories(getOwnerId());

  if (!force) {
    const cached = cache.get<Category[]>(key);
    if (cached) return cached;
  }

  return dedup(key, async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, display_order')
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
  return cache.get<Category[]>(CacheKeys.categories(getOwnerId())) || [];
};

// --- Products ---

export const loadProducts = async (force = false): Promise<Product[]> => {
  const key = CacheKeys.products(getOwnerId());

  if (!force) {
    const cached = cache.get<Product[]>(key);
    if (cached) return cached;
  }

  return dedup(key, async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, category, price, cost, image_url, additional_images, stock_quantity, sizes, colors, variants, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading products:', error);
        return cache.get<Product[]>(key) || [];
      }

      const products = data?.map(formatProduct) || [];
      cache.set(key, products, CacheTTL.MEDIUM, CacheTTL.STALE);
      return products;
    } catch (error) {
      console.error('Error loading products:', error);
      return cache.get<Product[]>(key) || [];
    }
  });
};

export const getProductsSync = (): Product[] => {
  return cache.get<Product[]>(CacheKeys.products(getOwnerId())) || [];
};

// Keep backward compat
export let products: Product[] = [];

export const reloadProducts = async (): Promise<void> => {
  const loaded = await loadProducts(true);
  products = loaded;
};

// --- Cache Invalidation ---

export const invalidateCache = () => {
  cache.flushAll();
};

export const invalidateProducts = () => {
  cache.flushByPrefix('products:');
};

export const invalidateCategories = () => {
  cache.flushByPrefix('categories:');
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
        category: product.category,
        price: product.price,
        cost: product.cost || null,
        image_url: product.image,
        additional_images: product.additionalImages || [],
        stock_quantity: product.stockQuantity || null,
        colors: product.colors ? JSON.parse(JSON.stringify(product.colors)) : null,
        sizes: product.sizes || null,
        variants: product.variants ? JSON.parse(JSON.stringify(product.variants)) : null,
        owner_id: user.id
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    if (data) {
      const key = CacheKeys.products(user.id);
      const current = cache.get<Product[]>(key) || [];
      cache.set(key, [formatProduct(data), ...current], CacheTTL.MEDIUM, CacheTTL.STALE);
      products = cache.get<Product[]>(key) || [];
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to add product' };
  }
};

export const updateProduct = async (productId: string, updatedProduct: Product): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('products')
      .update({
        name: updatedProduct.name,
        description: updatedProduct.description,
        category: updatedProduct.category,
        price: updatedProduct.price,
        cost: updatedProduct.cost || null,
        image_url: updatedProduct.image,
        additional_images: updatedProduct.additionalImages || [],
        stock_quantity: updatedProduct.stockQuantity || null,
        colors: updatedProduct.colors ? JSON.parse(JSON.stringify(updatedProduct.colors)) : null,
        sizes: updatedProduct.sizes || null,
        variants: updatedProduct.variants ? JSON.parse(JSON.stringify(updatedProduct.variants)) : null
      })
      .eq('id', productId);

    if (error) return { success: false, error: error.message };

    const key = CacheKeys.products(getOwnerId());
    const current = cache.get<Product[]>(key) || [];
    cache.set(key, current.map(p => p.id === productId ? { ...updatedProduct, id: productId } : p), CacheTTL.MEDIUM, CacheTTL.STALE);
    products = cache.get<Product[]>(key) || [];

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update product' };
  }
};

export const deleteProduct = async (productId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

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
    const { error } = await supabase
      .from('categories')
      .update({ name: updatedCategory.name, display_order: updatedCategory.order || 0 })
      .eq('id', categoryId);

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
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) return { success: false, error: error.message };

    const key = CacheKeys.categories(getOwnerId());
    const current = cache.get<Category[]>(key) || [];
    cache.set(key, current.filter(c => c.id !== categoryId), CacheTTL.MEDIUM, CacheTTL.STALE);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete category' };
  }
};
