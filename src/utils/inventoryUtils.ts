import { Product, ProductVariant } from '@/types';

export const hasVariantOptions = (product: Product): boolean =>
  (product.sizes?.length ?? 0) > 0 || (product.colors?.length ?? 0) > 0;

export const requiresSizeSelection = (product: Product): boolean =>
  (product.sizes?.length ?? 0) > 0;

export const requiresColorSelection = (product: Product): boolean =>
  (product.colors?.length ?? 0) > 0;

const variantMatches = (
  variant: ProductVariant,
  size?: string,
  color?: string
): boolean => {
  const sizeOk = !size || variant.size === size;
  const colorOk = !color || variant.color === color;
  return sizeOk && colorOk;
};

export const findVariant = (
  product: Product,
  size?: string,
  color?: string
): ProductVariant | undefined => {
  if (!product.variants?.length) return undefined;
  return product.variants.find((v) => variantMatches(v, size, color));
};

export const getAvailableQty = (
  product: Product,
  size?: string,
  color?: string
): number => {
  const aggregate = product.stockQuantity ?? 0;

  if (product.variants?.length) {
    if (size || color) {
      const variant = findVariant(product, size, color);
      if (!variant) return 0;
      return Math.min(variant.quantity, aggregate);
    }
    const variantSum = product.variants.reduce((s, v) => s + (v.quantity || 0), 0);
    return Math.min(variantSum, aggregate);
  }

  return aggregate;
};

export const isProductDiscountActive = (product: Product): boolean => {
  if (!product.discountType || product.discountType === 'none') return false;
  const now = Date.now();
  if (product.discountStartDate && new Date(product.discountStartDate).getTime() > now) {
    return false;
  }
  if (product.discountEndDate && new Date(product.discountEndDate).getTime() < now) {
    return false;
  }
  return (product.discountValue ?? 0) > 0;
};

export const computeDiscountedPrice = (product: Product): number => {
  const base = product.originalPrice ?? product.price;
  const value = product.discountValue ?? 0;

  if (!isProductDiscountActive(product)) return product.price;

  if (product.discountType === 'percentage') {
    return Math.max(0, Math.round(base * (1 - value / 100)));
  }

  if (product.discountType === 'amount') {
    return Math.max(0, base - value);
  }

  return product.price;
};

export const applyActiveDiscount = (product: Product): Product => {
  if (!isProductDiscountActive(product)) {
    if (product.originalPrice && product.originalPrice !== product.price) {
      return { ...product, price: product.originalPrice, discountType: 'none' as const };
    }
    return product;
  }

  const originalPrice = product.originalPrice ?? product.price;
  return {
    ...product,
    originalPrice,
    price: computeDiscountedPrice({ ...product, originalPrice }),
  };
};

export const scaleVariantsToTotal = (
  variants: ProductVariant[],
  newTotal: number
): ProductVariant[] => {
  if (variants.length === 0) return variants;

  const currentTotal = variants.reduce((s, v) => s + (v.quantity || 0), 0);
  if (currentTotal <= 0) {
    return variants.map((v, i) => ({ ...v, quantity: i === 0 ? newTotal : 0 }));
  }

  const scaled = variants.map((v) => ({
    ...v,
    quantity: Math.floor(((v.quantity || 0) / currentTotal) * newTotal),
  }));

  const scaledSum = scaled.reduce((s, v) => s + v.quantity, 0);
  const remainder = newTotal - scaledSum;
  if (remainder > 0) {
    scaled[0] = { ...scaled[0], quantity: scaled[0].quantity + remainder };
  }

  return scaled;
};

export const validateVariantSelection = (
  product: Product,
  size?: string,
  color?: string
): { valid: boolean; message?: string } => {
  if (requiresSizeSelection(product) && !size) {
    return { valid: false, message: 'يرجى اختيار المقاس' };
  }
  if (requiresColorSelection(product) && !color) {
    return { valid: false, message: 'يرجى اختيار اللون' };
  }
  if (hasVariantOptions(product) && product.variants?.length) {
    const available = getAvailableQty(product, size, color);
    if (available <= 0) {
      return { valid: false, message: 'هذا التركيب غير متوفر في المخزون' };
    }
  }
  return { valid: true };
};
