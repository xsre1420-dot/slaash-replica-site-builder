import { useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Product } from "@/types";
import { loadProducts, getProductById } from "@/services/productService";
import { fetchStorefrontProductById } from "@/services/storefrontProductService";

export type ProductLoadStatus = "loading" | "success" | "not_found";

interface ProductDataProps {
  productId: string | undefined;
  /** Pre-resolved product (e.g. from store listing navigation) */
  initialProduct?: Product | null;
  onProductLoaded: (product: Product | null, status: ProductLoadStatus) => void;
}

const ProductData = ({ productId, initialProduct, onProductLoaded }: ProductDataProps) => {
  const { username: storeSlug } = useParams<{ username?: string }>();
  const onLoadedRef = useRef(onProductLoaded);
  onLoadedRef.current = onProductLoaded;

  const loadProduct = useCallback(async (signal: AbortSignal) => {
    if (!productId) {
      if (!signal.aborted) onLoadedRef.current(null, "not_found");
      return;
    }

    if (initialProduct?.id === productId) {
      if (!signal.aborted) onLoadedRef.current(initialProduct, "success");
      return;
    }

    try {
      if (storeSlug) {
        const product = await fetchStorefrontProductById(storeSlug, productId);
        if (signal.aborted) return;
        onLoadedRef.current(product, product ? "success" : "not_found");
        return;
      }

      await loadProducts(true);
      if (signal.aborted) return;
      const foundProduct = getProductById(productId);
      onLoadedRef.current(foundProduct ?? null, foundProduct ? "success" : "not_found");
    } catch (err) {
      console.error("[ProductData] load failed:", err);
      if (!signal.aborted) onLoadedRef.current(null, "not_found");
    }
  }, [productId, storeSlug, initialProduct]);

  useEffect(() => {
    const controller = new AbortController();
    onLoadedRef.current(null, "loading");
    void loadProduct(controller.signal);
    return () => controller.abort();
  }, [loadProduct]);

  return null;
};

export default ProductData;
