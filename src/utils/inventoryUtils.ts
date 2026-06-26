import { Product, ProductVariant, ColorOption } from '@/types';

export const variantStockSum = (variants?: ProductVariant[]) =>
  (variants ?? []).reduce((sum, v) => sum + (v.quantity || 0), 0);

/**
 * Align stock_quantity and variants so storefront/checkout match inventory management.
 * - Aggregate-only: drop zero-qty variant rows when stock_quantity holds the truth.
 * - Variant-only drift: lift stock_quantity to variant sum when aggregate is stale at 0.
 */
export const normalizeProductStock = (product: Product): Product => {
  const variants = product.variants?.length ? [...product.variants] : undefined;
  const sum = variantStockSum(variants);
  const aggregate = product.stockQuantity;

  if ((aggregate ?? 0) > 0 && sum <= 0 && variants?.length) {
    return { ...product, variants: undefined };
  }

  if ((aggregate ?? 0) <= 0 && sum > 0) {
    return { ...product, stockQuantity: sum, variants };
  }

  return product;
};

export const hasVariantOptions = (product: Product): boolean =>
  product.hasOptions === true ||
  (product.sizes?.length ?? 0) > 0 ||
  (product.colors?.length ?? 0) > 0 ||
  (product.variants?.length ?? 0) > 0;

export const requiresSizeSelection = (product: Product): boolean =>
  (product.sizes?.length ?? 0) > 0;

export const requiresColorSelection = (product: Product): boolean =>
  (product.colors?.length ?? 0) > 0;

const colorMatches = (
  variantColor: string | undefined,
  selected: string | undefined,
  colors?: ColorOption[]
): boolean => {
  if (!selected) return true;
  if (!variantColor) return false;
  if (variantColor === selected || variantColor.toLowerCase() === selected.toLowerCase()) {
    return true;
  }
  const option = colors?.find(
    (c) =>
      c.value === selected ||
      c.name === selected ||
      c.value.toLowerCase() === selected.toLowerCase() ||
      (c.name != null && c.name.toLowerCase() === selected.toLowerCase())
  );
  if (!option) return false;
  return (
    variantColor === option.value ||
    variantColor === option.name ||
    (option.name != null && variantColor.toLowerCase() === option.name.toLowerCase())
  );
};

const variantMatches = (
  variant: ProductVariant,
  size?: string,
  color?: string,
  colors?: ColorOption[]
): boolean => {
  const sizeOk = !size || variant.size === size;
  return sizeOk && colorMatches(variant.color, color, colors);
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
  return product.variants.find((v) =>
    variantMatches(v, normalizedSize, normalizedColor, product.colors)
  );
};

export const getAvailableQty = (
  product: Product,
  size?: string,
  color?: string
): number => {
  const normalized = normalizeProductStock(product);
  const normalizedSize = normalizeDim(size);
  const normalizedColor = normalizeDim(color);

  const aggregate =
    normalized.stockQuantity == null || normalized.stockQuantity < 0
      ? Number.MAX_SAFE_INTEGER
      : normalized.stockQuantity;

  if (!normalized.variants?.length) {
    return aggregate;
  }

  if (normalizedSize || normalizedColor) {
    const variant = findVariant(normalized, normalizedSize, normalizedColor);
    const variantQty = variant?.quantity ?? 0;
    if (variantQty > 0) {
      if (aggregate === 0) return variantQty;
      return capByAggregate(variantQty, aggregate);
    }
    if (aggregate > 0 && aggregate !== Number.MAX_SAFE_INTEGER) {
      return aggregate;
    }
    const partialSum = normalized.variants
      .filter((v) => {
        const sizeOk = !normalizedSize || v.size === normalizedSize;
        const colorOk = !normalizedColor || colorMatches(v.color, normalizedColor, normalized.colors);
        return sizeOk && colorOk;
      })
      .reduce((sum, v) => sum + (v.quantity || 0), 0);
    if (partialSum > 0) {
      return aggregate === Number.MAX_SAFE_INTEGER ? partialSum : capByAggregate(partialSum, aggregate);
    }
    return 0;
  }

  const sum = variantStockSum(normalized.variants);
  if (sum > 0) {
    if (aggregate === 0) return sum;
    return capByAggregate(sum, aggregate);
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
    const base = Math.floor(newTotal / variants.length);
    const extra = newTotal % variants.length;
    return variants.map((v, i) => ({
      ...v,
      quantity: base + (i < extra ? 1 : 0),
    }));
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

/** Build or rescale variant rows from sizes/colors when inventory is updated. */
export const buildVariantsForStock = (
  product: Pick<Product, 'sizes' | 'colors' | 'variants'>,
  totalQty: number
): ProductVariant[] | undefined => {
  const sizes = product.sizes ?? [];
  const colors = product.colors ?? [];

  if (sizes.length === 0 && colors.length === 0) {
    return product.variants?.length
      ? scaleVariantsToTotal(product.variants, totalQty)
      : undefined;
  }

  const combos: ProductVariant[] = [];

  if (sizes.length > 0 && colors.length > 0) {
    for (const color of colors) {
      for (const size of sizes) {
        const existing = product.variants?.find(
          (v) => v.size === size && colorMatches(v.color, color.value, [color])
        );
        combos.push({
          size,
          color: color.value,
          quantity: existing?.quantity ?? 0,
        });
      }
    }
  } else if (colors.length > 0) {
    for (const color of colors) {
      const existing = product.variants?.find(
        (v) => !v.size && colorMatches(v.color, color.value, [color])
      );
      combos.push({ color: color.value, quantity: existing?.quantity ?? 0 });
    }
  } else {
    for (const size of sizes) {
      const existing = product.variants?.find((v) => v.size === size && !v.color);
      combos.push({ size, quantity: existing?.quantity ?? 0 });
    }
  }

  return scaleVariantsToTotal(combos, totalQty);
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
