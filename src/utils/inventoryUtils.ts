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
  const colorOk =
    !color ||
    variant.color === color ||
    variant.color?.toLowerCase() === color.toLowerCase();
  return sizeOk && colorOk;
};

const normalizeDim = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const capByAggregate = (qty: number, aggregate: number) =>
  aggregate === Number.MAX_SAFE_INTEGER ? qty : Math.min(qty, aggregate);

export const findVariant = (
  product: Product,
  size?: string,
  color?: string
): ProductVariant | undefined => {
  if (!product.variants?.length) return undefined;
  const normalizedSize = normalizeDim(size);
  const normalizedColor = normalizeDim(color);
  return product.variants.find((v) => variantMatches(v, normalizedSize, normalizedColor));
};

export const getAvailableQty = (
  product: Product,
  size?: string,
  color?: string
): number => {
  const normalizedSize = normalizeDim(size);
  const normalizedColor = normalizeDim(color);

  const aggregate =
    product.stockQuantity == null || product.stockQuantity < 0
      ? Number.MAX_SAFE_INTEGER
      : product.stockQuantity;

  if (!product.variants?.length) {
    return aggregate;
  }

  if (normalizedSize || normalizedColor) {
    const variant = findVariant(product, normalizedSize, normalizedColor);
    const variantQty = variant?.quantity ?? 0;
    if (variantQty > 0) {
      if (aggregate === 0) return variantQty;
      return capByAggregate(variantQty, aggregate);
    }
    if (aggregate > 0 && aggregate !== Number.MAX_SAFE_INTEGER) {
      return aggregate;
    }
    return 0;
  }

  const variantSum = product.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
  if (variantSum > 0) {
    if (aggregate === 0) return variantSum;
    return capByAggregate(variantSum, aggregate);
  }

  // Variants exist but quantities are 0 — use total stock_quantity
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

/** Unit price used by checkout RPC (matches server-side effective price). */
export const getServerUnitPrice = (product: Product): number => {
  if (!isProductDiscountActive(product)) return product.price;
  return computeDiscountedPrice(product);
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
