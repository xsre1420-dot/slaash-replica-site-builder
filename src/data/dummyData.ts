
import { Product, Category } from "@/types";

export const categories: Category[] = [
  { id: "all", name: "الكل", order: 0 },
  { id: "fast-food", name: "الوجبات السريعة", order: 1 },
  { id: "main-dish", name: "الوجبات الرئيسية", order: 2 },
  { id: "appetizers", name: "المقبلات", order: 3 },
  { id: "drinks", name: "المشروبات", order: 4 },
];

// We're using let instead of const to allow updating the products array
export let products: Product[] = [
  {
    id: "1",
    name: "نصف دجاجة مشوية",
    description: "دجاجة كاملة مشوية + مقبلات + خبز",
    category: "main-dish",
    price: 6000,
    image: "/lovable-uploads/59c215d6-809e-4764-90cd-41fd1213f286.png"
  },
  {
    id: "2",
    name: "كباب لحم",
    description: "5 أسياخ كباب لحم + أرز + سلطة",
    category: "main-dish",
    price: 8000,
    image: "/lovable-uploads/59c215d6-809e-4764-90cd-41fd1213f286.png"
  },
  {
    id: "3",
    name: "سلطة خضراء",
    description: "طماطم، خيار، خس، زيتون، جبنة فيتا",
    category: "appetizers",
    price: 3000,
    image: "/lovable-uploads/59c215d6-809e-4764-90cd-41fd1213f286.png"
  },
  {
    id: "4",
    name: "عصير برتقال طازج",
    description: "عصير برتقال طبيعي 100%",
    category: "drinks",
    price: 2000,
    image: "/lovable-uploads/59c215d6-809e-4764-90cd-41fd1213f286.png"
  },
  {
    id: "5",
    name: "برغر لحم",
    description: "برغر لحم مع جبنة وصلصة خاصة + بطاطس",
    category: "fast-food",
    price: 5000,
    image: "/lovable-uploads/59c215d6-809e-4764-90cd-41fd1213f286.png"
  }
];

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
