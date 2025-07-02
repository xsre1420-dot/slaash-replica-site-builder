
import { useEffect, useState } from "react";
import { Product } from "@/types";
import { getProductById, reloadProducts } from "@/data/dummyData";

interface ProductDataProps {
  productId: string | undefined;
  onProductLoaded: (product: Product | null) => void;
}

const ProductData = ({ productId, onProductLoaded }: ProductDataProps) => {
  useEffect(() => {
    if (!productId) {
      onProductLoaded(null);
      return;
    }

    // Reload products from storage to ensure we have the latest data
    reloadProducts();
    
    // Get product from the main data source
    const foundProduct = getProductById(productId);
    onProductLoaded(foundProduct || null);
  }, [productId, onProductLoaded]);

  // This is a data-fetching component only, it doesn't render anything
  return null;
};

export default ProductData;
