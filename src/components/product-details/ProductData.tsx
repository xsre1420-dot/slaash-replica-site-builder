
import { useEffect, useState } from "react";
import { Product } from "@/types";
import { loadProducts, getProductById } from "@/data/dummyData";

interface ProductDataProps {
  productId: string | undefined;
  onProductLoaded: (product: Product | null) => void;
}

const ProductData = ({ productId, onProductLoaded }: ProductDataProps) => {
  useEffect(() => {
    const loadProductData = async () => {
      if (!productId) {
        onProductLoaded(null);
        return;
      }

      // Load products from Supabase to ensure we have the latest data
      await loadProducts();
      
      // Get product from the main data source
      const foundProduct = getProductById(productId);
      onProductLoaded(foundProduct || null);
    };

    loadProductData();
  }, [productId, onProductLoaded]);

  // This is a data-fetching component only, it doesn't render anything
  return null;
};

export default ProductData;
