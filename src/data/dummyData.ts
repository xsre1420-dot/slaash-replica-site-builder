
import { Product, Category, ColorOption, ProductVariant } from "@/types";
import { supabase } from "@/integrations/supabase/client";

// Cache for in-memory storage
let categoriesCache: Category[] = [];
let productsCache: Product[] = [];

// Get categories from Supabase
export const getCategories = async (): Promise<Category[]> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('Error loading categories:', error);
      return categoriesCache;
    }
    
    const formattedCategories = data?.map(cat => ({
      id: cat.id,
      name: cat.name,
      order: cat.display_order || 0
    })) || [];
    
    categoriesCache = formattedCategories;
    return formattedCategories;
  } catch (error) {
    console.error('Error loading categories:', error);
    return categoriesCache;
  }
};

// Get categories synchronously (returns cached version)
export const getCategoriesSync = (): Category[] => {
  return categoriesCache;
};

// Load products from Supabase
export const loadProducts = async (): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading products:', error);
      return productsCache;
    }
    
    const formattedProducts = data?.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description || '',
      category: product.category,
      price: Number(product.price),
      cost: Number(product.cost) || undefined,
      image: product.image_url || '',
      additionalImages: product.additional_images || [],
      stockQuantity: product.stock_quantity || undefined,
      sizes: Array.isArray(product.sizes) ? product.sizes as string[] : undefined,
      colors: Array.isArray(product.colors) ? (product.colors as unknown as ColorOption[]) : undefined,
      variants: Array.isArray(product.variants) ? (product.variants as unknown as ProductVariant[]) : undefined
    })) || [];
    
    productsCache = formattedProducts;
    return formattedProducts;
  } catch (error) {
    console.error('Error loading products:', error);
    return productsCache;
  }
};

// Get products synchronously (returns cached version)
export const getProductsSync = (): Product[] => {
  return productsCache;
};

// Backward compatibility - use sync version
export let products: Product[] = productsCache;

// Function to reload products from Supabase
export const reloadProducts = async (): Promise<void> => {
  await loadProducts();
  products = productsCache;
};

// Function to add a new product to Supabase
export const addProduct = async (product: Product): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { error } = await supabase
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
      });

    if (error) {
      console.error('Error adding product:', error);
      return { success: false, error: error.message };
    }

    // Reload products to update cache
    await loadProducts();
    products = productsCache;
    
    return { success: true };
  } catch (error) {
    console.error('Error adding product:', error);
    return { success: false, error: 'Failed to add product' };
  }
};

// Function to update an existing product in Supabase
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

    // Reload products to update cache
    await loadProducts();
    products = productsCache;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: 'Failed to update product' };
  }
};

// Function to delete a product from Supabase
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

    // Reload products to update cache
    await loadProducts();
    products = productsCache;
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: 'Failed to delete product' };
  }
};

// Get products by category
export const getProductsByCategory = (categoryId: string): Product[] => {
  if (categoryId === "all") {
    return productsCache;
  }
  return productsCache.filter(product => product.category === categoryId);
};

// Add a new category to Supabase
export const addCategory = async (category: Category): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('categories')
      .insert({
        id: category.id,
        name: category.name,
        display_order: category.order || 0,
        owner_id: user.id
      });

    if (error) {
      console.error('Error adding category:', error);
      return { success: false, error: error.message };
    }

    // Reload categories to update cache
    await getCategories();
    
    return { success: true };
  } catch (error) {
    console.error('Error adding category:', error);
    return { success: false, error: 'Failed to add category' };
  }
};

// Update an existing category in Supabase
export const updateCategory = async (categoryId: string, updatedCategory: Category): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('categories')
      .update({
        name: updatedCategory.name,
        display_order: updatedCategory.order || 0
      })
      .eq('id', categoryId);

    if (error) {
      console.error('Error updating category:', error);
      return { success: false, error: error.message };
    }

    // Reload categories to update cache
    await getCategories();
    
    return { success: true };
  } catch (error) {
    console.error('Error updating category:', error);
    return { success: false, error: 'Failed to update category' };
  }
};

// Delete a category from Supabase
export const deleteCategory = async (categoryId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      console.error('Error deleting category:', error);
      return { success: false, error: error.message };
    }

    // Reload categories to update cache
    await getCategories();
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting category:', error);
    return { success: false, error: 'Failed to delete category' };
  }
};

// Get product by ID
export const getProductById = (id: string): Product | undefined => {
  return productsCache.find(product => product.id === id);
};

// Initialize data on module load
(async () => {
  await getCategories();
  await loadProducts();
})();
