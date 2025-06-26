
import { Product, Category } from "@/types";

export const categories: Category[] = [
  { id: "all", name: "الكل", order: 0 },
  { id: "fast-food", name: "الوجبات السريعة", order: 1 },
  { id: "main-dish", name: "الوجبات الرئيسية", order: 2 },
  { id: "appetizers", name: "المقبلات", order: 3 },
  { id: "drinks", name: "المشروبات", order: 4 },
];

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
