import { useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Product, ColorOption, ProductVariant } from "@/types";
import { loadProducts, getProductById } from "@/data/dummyData";
import { supabase } from "@/integrations/supabase/client";

interface ProductDataProps {
  productId: string | undefined;
  /** Pre-resolved product from tenant catalog — skips RPC when provided */
  initialProduct?: Product | null;
  onProductLoaded: (product: Product | null) => void;
}

export const formatRpcProduct = (p: Record<string, unknown>): Product => ({
  id: p.id as string,
  name: p.name as string,
  description: (p.description as string) || '',
  category: p.category as string,
  price: Number(p.price),
  image: (p.image_url as string) || '',
  additionalImages: (p.additional_images as string[]) || [],
  stockQuantity: p.stock_quantity != null ? Number(p.stock_quantity) : undefined,
  sizes: Array.isArray(p.sizes) ? p.sizes as string[] : undefined,
  colors: (() => {
    if (!p.colors) return undefined;
    if (typeof p.colors === 'string') {
      try { return JSON.parse(p.colors) as ColorOption[]; } catch { return undefined; }
    }
    if (Array.isArray(p.colors)) return p.colors as unknown as ColorOption[];
    return undefined;
  })(),
  variants: (() => {
    if (!p.variants) return undefined;
    if (typeof p.variants === 'string') {
      try { return JSON.parse(p.variants) as ProductVariant[]; } catch { return undefined; }
    }
    if (Array.isArray(p.variants)) return p.variants as unknown as ProductVariant[];
    return undefined;
  })(),
  discountType: p.discount_type as Product['discountType'],
  discountValue: p.discount_value ? Number(p.discount_value) : undefined,
  originalPrice: p.original_price ? Number(p.original_price) : undefined,
});

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
        onProductLoaded(formatRpcProduct(data));
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
