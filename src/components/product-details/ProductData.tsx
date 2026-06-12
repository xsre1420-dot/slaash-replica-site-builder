import { useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Product } from "@/types";
import { loadProducts, getProductById } from "@/services/productService";
import { supabase } from "@/integrations/supabase/client";
import { mapStorefrontProduct } from "@/mappers/productMapper";

interface ProductDataProps {
  productId: string | undefined;
  /** Pre-resolved product from tenant catalog — skips RPC when provided */
  initialProduct?: Product | null;
  onProductLoaded: (product: Product | null) => void;
}

const ProductData = ({ productId, initialProduct, onProductLoaded }: ProductDataProps) => {
  const { username: storeSlug } = useParams<{ username?: string }>();

  const loadProduct = useCallback(async () => {
    if (!productId) {
      onProductLoaded(null);
      return;
    }

    if (initialProduct?.id === productId) {
      onProductLoaded(initialProduct);
      return;
    }

    if (storeSlug) {
      const { data, error } = await (supabase as any).rpc('get_store_product_by_id', {
        p_slug: storeSlug.trim().toLowerCase(),
        p_product_id: productId,
      });

      if (!error && data) {
        onProductLoaded(mapStorefrontProduct(data as Record<string, unknown>));
        return;
      }

      onProductLoaded(null);
      return;
    }

    await loadProducts();
    const foundProduct = getProductById(productId);
    onProductLoaded(foundProduct || null);
  }, [productId, storeSlug, initialProduct, onProductLoaded]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  return null;
};

export default ProductData;
