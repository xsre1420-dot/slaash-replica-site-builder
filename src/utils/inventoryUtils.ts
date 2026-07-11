import { Product, ProductVariant, ColorOption } from '@/types';

export const variantStockSum = (variants?: ProductVariant[]) =>
  (variants ?? []).reduce((sum, v) => sum + (v.quantity || 0), 0);

export const getVariantDisplayLabel = (
  variant: ProductVariant,
  colors?: ColorOption[]
): string => {
  const parts: string[] = [];
  if (variant.size) parts.push(variant.size);
  if (variant.color) {
    const match = colors?.find(
      (c) =>
        c.value === variant.color ||
        c.name === variant.color ||
        c.value.toLowerCase() === variant.color?.toLowerCase()
    );
    if (match?.name) parts.push(match.name);
  }
  return parts.join(' · ') || 'افتراضي';
};

export const hasEditableVariants = (product: Pick<Product, 'variants' | 'sizes' | 'colors' | 'hasOptions'>) =>
  hasVariantOptions(product);

/** Build size/color combo rows without rescaling quantities. */
export const buildVariantCombosFromOptions = (
  product: Pick<Product, 'sizes' | 'colors' | 'variants'>
): ProductVariant[] => {
  const sizes = product.sizes ?? [];
  const colors = product.colors ?? [];

  if (sizes.length === 0 && colors.length === 0) {
    return (product.variants ?? []).map((variant) => ({
      ...variant,
      quantity: Math.max(0, Number(variant.quantity) || 0),
    }));
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
          quantity: Math.max(0, Number(existing?.quantity) || 0),
        });
      }
    }
  } else if (colors.length > 0) {
    for (const color of colors) {
      const existing = product.variants?.find(
        (v) => !v.size && colorMatches(v.color, color.value, [color])
      );
      combos.push({
        color: color.value,
        quantity: Math.max(0, Number(existing?.quantity) || 0),
      });
    }
  } else {
    for (const size of sizes) {
      const existing = product.variants?.find((v) => v.size === size && !v.color);
      combos.push({
        size,
        quantity: Math.max(0, Number(existing?.quantity) || 0),
      });
    }
  }

  return combos;
};

/** Resolve variant rows for merchant stock editing (preserves per-combo quantities). */
export const resolveProductVariantsForEdit = (product: Product): ProductVariant[] => {
  const hydrated = hydrateProductVariantOptions(product);
  if (hasVariantOptions(hydrated)) {
    return buildVariantCombosFromOptions(hydrated);
  }
  return (hydrated.variants ?? []).map((variant) => ({
    ...variant,
    quantity: Math.max(0, Number(variant.quantity) || 0),
  }));
};

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
    const hasOptions =
      product.hasOptions === true ||
      (product.sizes?.length ?? 0) > 0 ||
      (product.colors?.length ?? 0) > 0;
    if (!hasOptions) {
      return { ...product, variants: undefined };
    }
  }

  if ((aggregate ?? 0) <= 0 && sum > 0) {
    return { ...product, stockQuantity: sum, variants };
  }

  // Legacy bug: empty stock field was saved as aggregate 0 — treat as unlimited when no variant rows.
  if (
    aggregate === 0 &&
    !variants?.length &&
    !product.sizes?.length &&
    !product.colors?.length &&
    product.hasOptions !== true
  ) {
    return { ...product, stockQuantity: undefined };
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

/** Ensures sizes/colors arrays exist — derives from variants when DB/RPC omits option lists. */
export const hydrateProductVariantOptions = (product: Product): Product => {
  const variants =
    product.variants?.map((variant) => ({
      ...variant,
      size: variant.size?.trim() || undefined,
      color: variant.color?.trim() || undefined,
      quantity: Number(variant.quantity) || 0,
    })) ?? [];

  let sizes = product.sizes?.map((s) => s.trim()).filter(Boolean) ?? [];
  let colors =
    product.colors
      ?.filter((color) => color?.value?.trim())
      .map((color) => ({
        ...color,
        value: color.value.trim(),
        name: color.name?.trim() || color.value.trim(),
      })) ?? [];

  if (!sizes.length && variants.length) {
    sizes = [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))];
  }

  if (!colors.length && variants.length) {
    const values = [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))];
    colors = values.map((value) => {
      const existing = product.colors?.find(
        (c) => c.value === value || c.name === value
      );
      return existing ?? { value, name: value };
    });
  }

  return {
    ...product,
    sizes: sizes.length ? sizes : undefined,
    colors: colors.length ? colors : undefined,
    variants: variants.length ? variants : product.variants,
    hasOptions:
      product.hasOptions === true ||
      sizes.length > 0 ||
      colors.length > 0 ||
      variants.length > 0,
  };
};

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

/** Match a variant color key to its ColorOption (name, value, or legacy hex). */
export const findVariantColorOption = (
  colors: ColorOption[] | undefined,
  variantColor?: string
): ColorOption | undefined => {
  if (!variantColor?.trim() || !colors?.length) return undefined;
  return colors.find((c) => colorMatches(variantColor, c.value, colors));
};

export const isHexColorValue = (value: string) => /^#[0-9a-f]{3,8}$/i.test(value.trim());

/** Visual color chip for a variant — swatch from hex, label from color name (not product photo). */
export const resolveVariantColorSwatch = (
  colors: ColorOption[] | undefined,
  variantColor?: string
): { name?: string; swatch?: string } => {
  const option = findVariantColorOption(colors, variantColor);
  const rawName =
    option?.name?.trim() ||
    (variantColor && !isHexColorValue(variantColor) ? variantColor.trim() : undefined);
  const name = rawName && !isHexColorValue(rawName) ? rawName : undefined;
  const candidate = option?.value?.trim() || variantColor?.trim();
  const swatch = candidate && isHexColorValue(candidate) ? candidate : undefined;
  return { name, swatch };
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
  const combos = buildVariantCombosFromOptions(product);
  if (combos.length === 0) return undefined;
  return scaleVariantsToTotal(combos, totalQty);
};

export const validateVariantSelection = (
  product: Product,
  size?: string,
  color?: string
): { valid: boolean; message?: string } => {
  if (requiresSizeSelection(product) && !size) {
    return { valid: false, message: 'يرجى اختيار القياس' };
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
