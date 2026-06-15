import { useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Product } from "@/types";
import { loadProducts, getProductById } from "@/services/productService";
import { fetchStorefrontProductById } from "@/services/storefrontProductService";

export type ProductLoadStatus = "loading" | "success" | "not_found" | "error";

interface ProductDataProps {
  productId: string | undefined;
  /** Pre-resolved product from tenant catalog — skips network when provided */
  initialProduct?: Product | null;
  onProductLoaded: (product: Product | null, status: ProductLoadStatus) => void;
}

const ProductData = ({ productId, initialProduct, onProductLoaded }: ProductDataProps) => {
  const { username: storeSlug } = useParams<{ username?: string }>();

  const loadProduct = useCallback(async () => {
    if (!productId) {
      onProductLoaded(null, "not_found");
      return;
    }

    if (initialProduct?.id === productId) {
      onProductLoaded(initialProduct, "success");
      return;
    }

    try {
      if (storeSlug) {
        const product = await fetchStorefrontProductById(storeSlug, productId);
        onProductLoaded(product, product ? "success" : "not_found");
        return;
      }

      await loadProducts(true);
      const foundProduct = getProductById(productId);
      onProductLoaded(foundProduct ?? null, foundProduct ? "success" : "not_found");
    } catch (err) {
      console.error("[ProductData] load failed:", err);
      onProductLoaded(null, "error");
    }
  }, [productId, storeSlug, initialProduct, onProductLoaded]);

  useEffect(() => {
    onProductLoaded(null, "loading");
    loadProduct();
  }, [loadProduct, onProductLoaded]);

  return null;
};

export default ProductData;
