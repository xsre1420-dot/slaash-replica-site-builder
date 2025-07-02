
import { Product, Category } from "@/types";

// Load categories from localStorage instead of hardcoded ones
export const getCategories = (): Category[] => {
  const savedCategories = localStorage.getItem('categories');
  if (savedCategories) {
    try {
      return JSON.parse(savedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }
  return []; // Return empty array instead of default categories
};

export const categories: Category[] = getCategories();

// Load products from localStorage
const loadProductsFromStorage = (): Product[] => {
  const savedProducts = localStorage.getItem('products');
  if (savedProducts) {
    try {
      return JSON.parse(savedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }
  return [];
};

// Save products to localStorage
const saveProductsToStorage = (productsToSave: Product[]): void => {
  localStorage.setItem('products', JSON.stringify(productsToSave));
};

// Start with products from localStorage
export let products: Product[] = loadProductsFromStorage();

// Function to reload products from storage (useful when navigating between pages)
export const reloadProducts = (): void => {
  products = loadProductsFromStorage();
};

// Function to add a new product
export const addProduct = (product: Product): void => {
  products = [...products, product];
  saveProductsToStorage(products);
};

// Function to update an existing product
export const updateProduct = (productId: string, updatedProduct: Product): void => {
  products = products.map(p => p.id === productId ? updatedProduct : p);
  saveProductsToStorage(products);
};

// Get products by category
export const getProductsByCategory = (categoryId: string): Product[] => {
  if (categoryId === "all") {
    return products;
  }
  return products.filter(product => product.category === categoryId);
};

// Get product by ID
export const getProductById = (id: string): Product | undefined => {
  return products.find(product => product.id === id);
};
