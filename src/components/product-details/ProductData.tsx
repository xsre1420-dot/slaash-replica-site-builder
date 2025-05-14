
import { useEffect, useState } from "react";
import { Product } from "@/types";

interface ProductDataProps {
  productId: string | undefined;
  onProductLoaded: (product: Product | null) => void;
}

// Placeholder data for testing
const demoProducts: Product[] = [
  {
    id: "1",
    name: "برجر لحم",
    description: "برجر لحم طازج مع صلصة خاصة وخضروات",
    price: 8000,
    category: "برجر",
    image: "/placeholder.svg",
    additionalImages: ["/placeholder.svg", "/placeholder.svg"]
  },
  {
    id: "2",
    name: "فاهيتا دجاج",
    description: "فاهيتا دجاج مشوي مع صوص خاص وخضروات",
    price: 7000,
    category: "ساندويش",
    image: "/placeholder.svg"
  },
];

const ProductData = ({ productId, onProductLoaded }: ProductDataProps) => {
  useEffect(() => {
    // Fetch product from localStorage or use demo data
    const storedProducts = localStorage.getItem("products");
    let foundProduct: Product | undefined;

    if (storedProducts) {
      try {
        const parsedProducts = JSON.parse(storedProducts);
        foundProduct = parsedProducts.find((p: Product) => p.id === productId);
      } catch (error) {
        console.error("Error parsing products:", error);
      }
    }

    // If not found in localStorage, check demo products
    if (!foundProduct) {
      foundProduct = demoProducts.find((p) => p.id === productId);
    }

    onProductLoaded(foundProduct || null);
  }, [productId, onProductLoaded]);

  // This is a data-fetching component only, it doesn't render anything
  return null;
};

export default ProductData;
