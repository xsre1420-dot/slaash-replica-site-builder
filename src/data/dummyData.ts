
import { Product, Category, ColorOption, ProductVariant } from "@/types";
import { supabase } from "@/integrations/supabase/client";

// Smart cache with timestamps
let categoriesCache: Category[] = [];
let productsCache: Product[] = [];
let lastProductsFetch = 0;
let lastCategoriesFetch = 0;
const CACHE_TTL = 30_000; // 30 seconds

const isCacheValid = (lastFetch: number) => Date.now() - lastFetch < CACHE_TTL;

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

// Get categories from Supabase with smart caching
export const getCategories = async (force = false): Promise<Category[]> => {
  if (!force && isCacheValid(lastCategoriesFetch) && categoriesCache.length > 0) {
    return categoriesCache;
  }
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('Error loading categories:', error);
      return categoriesCache;
    }
    
    categoriesCache = data?.map(cat => ({
      id: cat.id,
      name: cat.name,
      order: cat.display_order || 0
    })) || [];
    lastCategoriesFetch = Date.now();
    return categoriesCache;
  } catch (error) {
    console.error('Error loading categories:', error);
    return categoriesCache;
  }
};

export const getCategoriesSync = (): Category[] => categoriesCache;

// Load products from Supabase with smart caching
export const loadProducts = async (force = false): Promise<Product[]> => {
  if (!force && isCacheValid(lastProductsFetch) && productsCache.length > 0) {
    return productsCache;
  }
  try {
    // Suggestion #14: Select only needed columns
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, category, price, cost, image_url, additional_images, stock_quantity, sizes, colors, variants, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading products:', error);
      return productsCache;
    }
    
    productsCache = data?.map(formatProduct) || [];
    lastProductsFetch = Date.now();
    return productsCache;
  } catch (error) {
    console.error('Error loading products:', error);
    return productsCache;
  }
};

export const getProductsSync = (): Product[] => productsCache;
export let products: Product[] = productsCache;

export const reloadProducts = async (): Promise<void> => {
  await loadProducts(true);
  products = productsCache;
};

// Invalidate cache (call after mutations)
export const invalidateCache = () => {
  lastProductsFetch = 0;
  lastCategoriesFetch = 0;
};

// Add product with optimistic update
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

    if (error) {
      console.error('Error adding product:', error);
      return { success: false, error: error.message };
    }

    // Optimistic: add to cache immediately without re-fetching
    if (data) {
      const newProduct = formatProduct(data);
      productsCache = [newProduct, ...productsCache];
      products = productsCache;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error adding product:', error);
    return { success: false, error: 'Failed to add product' };
  }
};

// Update product with optimistic update
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

    if (error) {
      console.error('Error updating product:', error);
      return { success: false, error: error.message };
    }

    // Optimistic update in cache
    productsCache = productsCache.map(p => 
      p.id === productId ? { ...updatedProduct, id: productId } : p
    );
    products = productsCache;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: 'Failed to update product' };
  }
};

// Delete product with optimistic update
export const deleteProduct = async (productId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Error deleting product:', error);
      return { success: false, error: error.message };
    }

    // Optimistic remove from cache
    productsCache = productsCache.filter(p => p.id !== productId);
    products = productsCache;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: 'Failed to delete product' };
  }
};

// Get products by category (from cache)
export const getProductsByCategory = (categoryId: string): Product[] => {
  if (categoryId === "all") return productsCache;
  return productsCache.filter(product => product.category === categoryId);
};

// Category CRUD with optimistic updates
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
      categoriesCache = [...categoriesCache, { id: data.id, name: data.name, order: data.display_order }];
    }
    return { success: true };
  } catch (error) {
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

    categoriesCache = categoriesCache.map(c => c.id === categoryId ? { ...updatedCategory, id: categoryId } : c);
    return { success: true };
  } catch (error) {
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

    categoriesCache = categoriesCache.filter(c => c.id !== categoryId);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete category' };
  }
};

export const getProductById = (id: string): Product | undefined => {
  return productsCache.find(product => product.id === id);
};

// Initialize data on module load
(async () => {
  await Promise.all([getCategories(), loadProducts()]);
})();
