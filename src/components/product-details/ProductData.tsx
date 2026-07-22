import { useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Product } from "@/types";
import { getProductById, fetchProductById } from "@/services/productService";
import { fetchStorefrontProductById } from "@/services/storefrontProductService";
import { StorefrontCacheKeys, getStorefrontCached } from "@/services/storefrontCacheService";

export type ProductLoadStatus = "loading" | "success" | "not_found";

interface ProductDataProps {
  productId: string | undefined;
  /** Pre-resolved product (e.g. from store listing navigation) */
  initialProduct?: Product | null;
  onProductLoaded: (product: Product | null, status: ProductLoadStatus) => void;
}

const countGalleryUrls = (product: Pick<Product, "image" | "additionalImages">): number => {
  const seen = new Set<string>();
  const main = product.image?.trim();
  if (main) seen.add(main);
  for (const url of product.additionalImages ?? []) {
    const trimmed = url?.trim();
    if (trimmed) seen.add(trimmed);
  }
  return seen.size;
};

const mergeFreshStock = (cached: Product | null | undefined, fresh: Product): Product => {
  const freshGalleryCount = countGalleryUrls(fresh);
  const cachedGalleryCount = cached ? countGalleryUrls(cached) : 0;
  const useFreshGallery = freshGalleryCount >= cachedGalleryCount;

  return {
    ...(cached ?? fresh),
    ...fresh,
    shortDescription: fresh.shortDescription?.trim() || cached?.shortDescription,
    description: fresh.description?.trim() || cached?.description,
    tags: fresh.tags?.length ? fresh.tags : cached?.tags,
    sku: fresh.sku || cached?.sku,
    additionalImages: useFreshGallery
      ? fresh.additionalImages
      : cached?.additionalImages?.length
        ? cached.additionalImages
        : fresh.additionalImages,
    image: useFreshGallery
      ? fresh.image?.trim() || cached?.image || fresh.image
      : cached?.image?.trim() || fresh.image,
    stockQuantity: fresh.stockQuantity,
    variants: fresh.variants?.length ? fresh.variants : cached?.variants,
    sizes: fresh.sizes?.length ? fresh.sizes : cached?.sizes,
    colors: fresh.colors?.length ? fresh.colors : cached?.colors,
    price: fresh.price,
    originalPrice: fresh.originalPrice ?? cached?.originalPrice,
    discountType: fresh.discountType ?? cached?.discountType,
    discountValue: fresh.discountValue ?? cached?.discountValue,
    discountStartDate: fresh.discountStartDate ?? cached?.discountStartDate,
    discountEndDate: fresh.discountEndDate ?? cached?.discountEndDate,
    isActive: fresh.isActive,
    archivedAt: fresh.archivedAt,
  };
};

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
        const normalizedSlug = storeSlug.trim().toLowerCase();
        const productCacheKey = StorefrontCacheKeys.product(normalizedSlug, productId);
        const cachedProduct =
          initialProduct?.id === productId
            ? initialProduct
            : getStorefrontCached<Product>(productCacheKey);

        if (cachedProduct && !signal.aborted) {
          onLoadedRef.current(cachedProduct, "success");
        }

        const fresh = await fetchStorefrontProductById(storeSlug, productId, { revalidate: true });
        if (signal.aborted) return;
        if (fresh) {
          const merged = cachedProduct ? mergeFreshStock(cachedProduct, fresh) : fresh;
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

      const fresh = await fetchProductById(productId);
      if (signal.aborted) return;
      if (fresh) {
        const merged =
          initialProduct?.id === productId ? mergeFreshStock(initialProduct, fresh) : fresh;
        onLoadedRef.current(merged, "success");
        return;
      }

      const cached =
        initialProduct?.id === productId ? initialProduct : getProductById(productId) ?? null;
      onLoadedRef.current(cached, cached ? "success" : "not_found");
    } catch (err) {
      console.error("[ProductData] load failed:", err);
      if (!signal.aborted) {
        const cached =
          initialProduct?.id === productId ? initialProduct : getProductById(productId) ?? null;
        onLoadedRef.current(cached, cached ? "success" : "not_found");
      }
    }
  }, [productId, storeSlug, initialProduct]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProduct(controller.signal);
    return () => controller.abort();
  }, [loadProduct, productId]);

  useEffect(() => {
    if (!storeSlug || !productId) return;

    const refetch = () => {
      void loadProduct(new AbortController().signal);
    };

    window.addEventListener("storefront:products-changed", refetch);
    return () => window.removeEventListener("storefront:products-changed", refetch);
  }, [storeSlug, productId, loadProduct]);

  return null;
};

export default ProductData;

