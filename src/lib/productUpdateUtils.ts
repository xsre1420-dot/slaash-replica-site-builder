import { Product } from '@/types';

/** Columns selected for product fetch/update round-trips */
export const PRODUCT_DETAIL_SELECT =
  'id, name, description, short_description, category, price, cost, original_price, image_url, additional_images, stock_quantity, sizes, colors, variants, discount_type, discount_value, discount_start_date, discount_end_date, is_active, sku, seo_title, seo_description, product_slug, tags, low_stock_threshold, min_stock_level, store_id, owner_id, created_at, updated_at';

/** Merge a partial UI patch onto an existing product without wiping omitted fields */
export const mergeProductForUpdate = (existing: Product, patch: Partial<Product>): Product => ({
  ...existing,
  ...patch,
  id: existing.id,
  // Preserve nested data when patch omits or clears intentionally
  additionalImages: patch.additionalImages ?? existing.additionalImages ?? [],
  sizes: patch.sizes !== undefined ? patch.sizes : existing.sizes,
  colors: patch.colors !== undefined ? patch.colors : existing.colors,
  variants: patch.variants !== undefined ? patch.variants : existing.variants,
  stockQuantity: patch.stockQuantity !== undefined ? patch.stockQuantity : existing.stockQuantity,
  cost: patch.cost !== undefined ? patch.cost : existing.cost,
  originalPrice: patch.originalPrice !== undefined ? patch.originalPrice : existing.originalPrice,
  shortDescription: patch.shortDescription !== undefined ? patch.shortDescription : existing.shortDescription,
  sku: patch.sku !== undefined ? patch.sku : existing.sku,
  seoTitle: patch.seoTitle !== undefined ? patch.seoTitle : existing.seoTitle,
  seoDescription: patch.seoDescription !== undefined ? patch.seoDescription : existing.seoDescription,
  productSlug: patch.productSlug !== undefined ? patch.productSlug : existing.productSlug,
  tags: patch.tags !== undefined ? patch.tags : existing.tags,
  lowStockThreshold: patch.lowStockThreshold !== undefined ? patch.lowStockThreshold : existing.lowStockThreshold,
  isActive: patch.isActive !== undefined ? patch.isActive : existing.isActive,
});

export const productToDbRow = (product: Product) => ({
  name: product.name,
  description: product.description,
  short_description: product.shortDescription || null,
  category: product.category,
  price: product.price,
  cost: product.cost ?? null,
  original_price: product.originalPrice ?? null,
  image_url: product.image,
  additional_images: product.additionalImages ?? [],
  stock_quantity: product.stockQuantity ?? null,
  colors: product.colors ? JSON.parse(JSON.stringify(product.colors)) : null,
  sizes: product.sizes ?? null,
  variants: product.variants ? JSON.parse(JSON.stringify(product.variants)) : null,
  sku: product.sku || null,
  seo_title: product.seoTitle || null,
  seo_description: product.seoDescription || null,
  product_slug: product.productSlug || null,
  tags: product.tags?.length ? product.tags : [],
  low_stock_threshold: product.lowStockThreshold ?? 3,
  min_stock_level: product.lowStockThreshold ?? 3,
  is_active: product.isActive !== false,
});

/** Per-product low-stock threshold with sensible default */
export const getProductLowStockThreshold = (product: Pick<Product, 'lowStockThreshold' | 'stockQuantity'>): number =>
  product.lowStockThreshold ?? 5;

export const isProductLowStock = (product: Pick<Product, 'stockQuantity' | 'lowStockThreshold'>): boolean => {
  const qty = product.stockQuantity;
  if (qty === undefined || qty <= 0) return false;
  return qty <= getProductLowStockThreshold(product);
};
