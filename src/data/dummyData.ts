
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

// Start with an empty products array - all products will be added manually
export let products: Product[] = [];

// Function to add a new product
export const addProduct = (product: Product): void => {
  products = [...products, product];
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
