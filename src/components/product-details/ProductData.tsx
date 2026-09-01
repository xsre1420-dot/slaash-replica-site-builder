import { useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types";
import { loadProductDetailPageBundle } from "@/services/productDetailPageService";

export type ProductLoadStatus = "loading" | "success" | "not_found";

interface ProductDataProps {
  productId: string | undefined;
  /** Pre-resolved product (e.g. from store listing navigation) */
  initialProduct?: Product | null;
  onProductLoaded: (product: Product | null, status: ProductLoadStatus) => void;
}

const ProductData = ({ productId, initialProduct, onProductLoaded }: ProductDataProps) => {
  const { username: storeSlug } = useParams<{ username?: string }>();
  const { user } = useAuth();
  const onLoadedRef = useRef(onProductLoaded);
  onLoadedRef.current = onProductLoaded;

  const loadProduct = useCallback(async (signal: AbortSignal) => {
    if (!productId) {
      if (!signal.aborted) onLoadedRef.current(null, "not_found");
      return;
    }

    try {
      const bundle = await loadProductDetailPageBundle(productId, {
        storeSlug: storeSlug || undefined,
        ownerId: !storeSlug ? user?.id : undefined,
        initialProduct,
      });
      if (signal.aborted) return;
      if (bundle.product) {
        onLoadedRef.current(bundle.product, "success");
        return;
      }
      if (initialProduct?.id === productId) {
        onLoadedRef.current(initialProduct, "success");
        return;
      }
      onLoadedRef.current(null, "not_found");
    } catch (err) {
      console.error("[ProductData] load failed:", err);
      if (!signal.aborted) {
        onLoadedRef.current(
          initialProduct?.id === productId ? initialProduct : null,
          initialProduct?.id === productId ? "success" : "not_found"
        );
      }
    }
  }, [productId, storeSlug, user?.id, initialProduct]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProduct(controller.signal);
    return () => controller.abort();
  }, [loadProduct, productId]);

  useEffect(() => {
    if (!productId) return;

    const refetch = () => {
      void loadProduct(new AbortController().signal);
    };

    window.addEventListener("storefront:products-changed", refetch);
    return () => window.removeEventListener("storefront:products-changed", refetch);
  }, [productId, loadProduct]);

  return null;
};

export default ProductData;
