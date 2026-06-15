import { Product, ColorOption, ProductVariant } from '@/types';
import { applyActiveDiscount } from '@/utils/inventoryUtils';

export const parseJsonField = <T>(value: unknown): T | undefined => {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) return value as T;
  return undefined;
};

/** Maps a database/RPC product row to domain `Product`. */
export const mapDbProduct = (
  row: Record<string, unknown>,
  options: { applyDiscount?: boolean } = {}
): Product => {
  const product: Product = {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ''),
    category: String(row.category || ''),
    price: Number(row.price),
    cost: row.cost != null ? Number(row.cost) : undefined,
    image: String(row.image_url || row.image || ''),
    additionalImages: (row.additional_images as string[]) || undefined,
    stockQuantity: row.stock_quantity != null ? Number(row.stock_quantity) : undefined,
    sizes: Array.isArray(row.sizes) ? (row.sizes as string[]) : undefined,
    colors: parseJsonField<ColorOption[]>(row.colors),
    variants: parseJsonField<ProductVariant[]>(row.variants),
    discountType: row.discount_type as Product['discountType'],
    discountValue: row.discount_value != null ? Number(row.discount_value) : undefined,
    discountStartDate: row.discount_start_date as string | undefined,
    discountEndDate: row.discount_end_date as string | undefined,
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    sku: (row.sku as string) || undefined,
    shortDescription: (row.short_description as string) || undefined,
    seoTitle: (row.seo_title as string) || undefined,
    seoDescription: (row.seo_description as string) || undefined,
    productSlug: (row.product_slug as string) || undefined,
    tags: parseJsonField<string[]>(row.tags),
    lowStockThreshold: row.low_stock_threshold != null
      ? Number(row.low_stock_threshold)
      : row.min_stock_level != null
        ? Number(row.min_stock_level)
        : undefined,
    isActive: row.is_active != null ? Boolean(row.is_active) : true,
  };

  return options.applyDiscount ? applyActiveDiscount(product) : product;
};

/** Storefront listing — always applies active discounts. */
export const mapStorefrontProduct = (row: Record<string, unknown>): Product =>
  mapDbProduct(row, { applyDiscount: true });

export const safeMapStorefrontProduct = (row: unknown): Product | null => {
  if (row == null) return null;
  let record: Record<string, unknown>;
  if (typeof row === 'string') {
    try {
      record = JSON.parse(row) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof row === 'object') {
    record = row as Record<string, unknown>;
  } else {
    return null;
  }
  try {
    return mapStorefrontProduct(record);
  } catch (err) {
    console.warn('[productMapper] storefront map failed:', err);
    return null;
  }
};
