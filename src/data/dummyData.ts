
import { Product, Category } from "@/types";
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
      image: product.image_url || '',
      additionalImages: product.additional_images || [],
      sizes: undefined, // Not implemented in Supabase schema yet
      colors: undefined // Not implemented in Supabase schema yet
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
        image_url: product.image,
        additional_images: product.additionalImages || [],
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
        image_url: updatedProduct.image,
        additional_images: updatedProduct.additionalImages || []
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

// Get product by ID
export const getProductById = (id: string): Product | undefined => {
  return productsCache.find(product => product.id === id);
};

// Initialize data on module load
(async () => {
  await getCategories();
  await loadProducts();
})();
