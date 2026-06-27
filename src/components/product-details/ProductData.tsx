import { useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Product } from "@/types";
import { getProductById, fetchProductById } from "@/services/productService";
import { fetchStorefrontProductById } from "@/services/storefrontProductService";

export type ProductLoadStatus = "loading" | "success" | "not_found";

interface ProductDataProps {
  productId: string | undefined;
  /** Pre-resolved product (e.g. from store listing navigation) */
  initialProduct?: Product | null;
  onProductLoaded: (product: Product | null, status: ProductLoadStatus) => void;
}

const mergeFreshStock = (cached: Product | null | undefined, fresh: Product): Product => ({
  ...(cached ?? fresh),
  ...fresh,
  stockQuantity: fresh.stockQuantity,
  variants: fresh.variants,
  sizes: fresh.sizes?.length ? fresh.sizes : cached?.sizes,
  colors: fresh.colors?.length ? fresh.colors : cached?.colors,
  price: fresh.price,
  originalPrice: fresh.originalPrice,
  discountType: fresh.discountType,
  discountValue: fresh.discountValue,
  discountStartDate: fresh.discountStartDate,
  discountEndDate: fresh.discountEndDate,
  isActive: fresh.isActive,
  archivedAt: fresh.archivedAt,
});

const ProductData = ({ productId, initialProduct, onProductLoaded }: ProductDataProps) => {
  const { username: storeSlug } = useParams<{ username?: string }>();
  const onLoadedRef = useRef(onProductLoaded);
  onLoadedRef.current = onProductLoaded;

  const loadProduct = useCallback(async (signal: AbortSignal) => {
    if (!productId) {
      if (!signal.aborted) onLoadedRef.current(null, "not_found");
      return;
    }

    try {
      if (storeSlug) {
        const fresh = await fetchStorefrontProductById(storeSlug, productId);
        if (signal.aborted) return;
        if (fresh) {
          const merged =
            initialProduct?.id === productId
              ? mergeFreshStock(initialProduct, fresh)
              : fresh;
          onLoadedRef.current(merged, "success");
          return;
        }
        if (initialProduct?.id === productId) {
          onLoadedRef.current(initialProduct, "success");
          return;
        }
        onLoadedRef.current(null, "not_found");
        return;
      }

      const foundProduct =
        (initialProduct?.id === productId ? initialProduct : getProductById(productId)) ??
        (await fetchProductById(productId));
      if (signal.aborted) return;
      onLoadedRef.current(foundProduct ?? null, foundProduct ? "success" : "not_found");
    } catch (err) {
      console.error("[ProductData] load failed:", err);
      if (!signal.aborted) {
        if (initialProduct?.id === productId) {
          onLoadedRef.current(initialProduct, "success");
        } else {
          onLoadedRef.current(null, "not_found");
        }
      }
    }
  }, [productId, storeSlug, initialProduct]);

  useEffect(() => {
    const controller = new AbortController();
    if (initialProduct?.id === productId) {
      onLoadedRef.current(initialProduct, "success");
    } else {
      onLoadedRef.current(null, "loading");
    }
    void loadProduct(controller.signal);
    return () => controller.abort();
  }, [loadProduct, initialProduct, productId]);

  return null;
};

export default ProductData;
