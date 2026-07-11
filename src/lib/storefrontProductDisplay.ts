import type { Product } from '@/types';
import { applyActiveDiscount, getAvailableQty, isProductDiscountActive } from '@/utils/inventoryUtils';

/** Sale / current unit price shown to customers. */
export const getProductSalePrice = (product: Product): number => {
  if (isProductDiscountActive(product)) {
    return applyActiveDiscount(product).price;
  }
  return product.price;
};

/** Strikethrough list price — compare-at or pre-discount. */
export const getProductListPrice = (product: Product): number | null => {
  if (isProductDiscountActive(product)) {
    const discounted = applyActiveDiscount(product);
    const list = discounted.originalPrice ?? product.price;
    return list > discounted.price ? list : null;
  }
  if (product.originalPrice != null && product.originalPrice > product.price) {
    return product.originalPrice;
  }
  return null;
};

export const hasPromotionalPricing = (product: Product): boolean =>
  getProductListPrice(product) != null;

export const getDiscountBadgeLabel = (product: Product): string | null => {
  if (isProductDiscountActive(product) && product.discountType === 'percentage' && product.discountValue) {
    return `-${product.discountValue}%`;
  }
  if (isProductDiscountActive(product) && product.discountType === 'amount' && product.discountValue) {
    return `-${product.discountValue.toLocaleString()} د.ع`;
  }
  const list = getProductListPrice(product);
  const sale = getProductSalePrice(product);
  if (list != null && list > sale) {
    const pct = Math.round(((list - sale) / list) * 100);
    return pct > 0 ? `-${pct}%` : null;
  }
  return null;
};

/** Short blurb for cards and hero — prefers merchant short description. */
export const getProductBlurb = (product: Product, maxLen = 160): string => {
  const raw = product.shortDescription?.trim() || product.description?.trim() || '';
  if (!raw) return '';
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen).trim()}…`;
};

/** Listing pages only — never fall back to full description. */
export const getProductListingBlurb = (product: Product, maxLen = 100): string => {
  const short = product.shortDescription?.trim();
  if (!short) return '';
  if (short.length <= maxLen) return short;
  return `${short.slice(0, maxLen).trim()}…`;
};

/** Detail page highlights — short description only (not full description). */
export const getProductHighlight = (product: Product): string =>
  product.shortDescription?.trim() || '';

const dedupeImageUrls = (urls: string[]): string[] => {
  const seen = new Set<string>();
  return urls.filter((url) => {
    if (!url?.trim() || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

/** Gallery URLs — switches to color-specific lead image when a color is selected. */
export const getProductGalleryImages = (product: Product, selectedColor?: string): string[] => {
  const additional = product.additionalImages?.filter(Boolean) ?? [];
  const base = dedupeImageUrls([
    product.image,
    ...additional.filter((url) => url !== product.image),
  ]);

  const fallback = base.length ? base : product.image ? [product.image] : [];
  if (!selectedColor?.trim() || !product.colors?.length) return fallback;

  const colorOpt = product.colors.find(
    (c) => c.value === selectedColor || c.name === selectedColor
  );
  if (!colorOpt?.image?.trim()) return fallback;

  return dedupeImageUrls([colorOpt.image, ...fallback.filter((url) => url !== colorOpt.image)]);
};

export const formatStorePrice = (amount: number): string =>
  `${amount.toLocaleString('ar-IQ')} د.ع`;

export const getProductOptionSummary = (product: Product): string | null => {
  const parts: string[] = [];
  if (product.sizes?.length) parts.push(`${product.sizes.length} قياس`);
  if (product.colors?.length) parts.push(`${product.colors.length} لون`);
  if (product.variants?.length) parts.push(`${product.variants.length} تركيبة`);
  return parts.length ? parts.join(' · ') : null;
};

export const getVariantOptionQty = (
  product: Product,
  opts: { size?: string; color?: string }
): number => getAvailableQty(product, opts.size, opts.color);
