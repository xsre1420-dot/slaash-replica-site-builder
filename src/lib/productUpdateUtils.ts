import { Product } from '@/types';

/** Oldest compatible columns — works before optional migrations */
export const PRODUCT_MINIMAL_SELECT =
  'id, name, description, category, price, image_url, additional_images, stock_quantity, is_active, owner_id, created_at, updated_at';

/** Insert return — never request columns that may be missing */
export const PRODUCT_INSERT_RETURN_MINIMAL =
  'id, name, description, category, price, image_url, additional_images, stock_quantity, is_active, owner_id, created_at, updated_at';

/** Columns selected for product fetch/update round-trips */
export const PRODUCT_DETAIL_SELECT =
  'id, name, description, short_description, category, price, cost, original_price, image_url, additional_images, stock_quantity, sizes, colors, variants, discount_type, discount_value, discount_start_date, discount_end_date, is_active, archived_at, sku, seo_title, seo_description, product_slug, tags, low_stock_threshold, min_stock_level, store_id, owner_id, created_at, updated_at';

/** Extended merchant list — requires migrations */
export const PRODUCT_INSERT_RETURN_SELECT =
  'id, name, description, category, price, cost, original_price, image_url, additional_images, stock_quantity, sizes, colors, variants, is_active, archived_at, min_stock_level, owner_id, created_at, updated_at';

/** Products grid — no description, cost, or variant JSON (largest list payload savings) */
export const MERCHANT_PRODUCTS_GRID_SELECT =
  'id, name, category, price, original_price, image_url, stock_quantity, is_active, archived_at, min_stock_level, discount_type, discount_value, discount_start_date, discount_end_date, created_at, updated_at';

/** Inventory list — stock/variant fields + sku/cost/barcode for merchant inventory hub */
export const MERCHANT_PRODUCTS_INVENTORY_SELECT =
  'id, name, category, price, cost, sku, barcode, image_url, stock_quantity, sizes, colors, variants, is_active, archived_at, min_stock_level, created_at, updated_at';

/** Storefront list / preview — card-shaped columns (no description, variants, or gallery extras) */
export const STOREFRONT_ACTIVE_LIST_SELECT =
  'id, name, category, price, original_price, image_url, stock_quantity, discount_type, discount_value, discount_start_date, discount_end_date, is_active, archived_at, product_slug, created_at';

/** Storefront product detail fallback — full gallery, no cost */
export const STOREFRONT_DETAIL_SELECT =
  'id, name, description, category, price, original_price, image_url, additional_images, stock_quantity, sizes, colors, variants, discount_type, discount_value, discount_start_date, discount_end_date, is_active, archived_at, created_at';

/** Merchant list/load — full columns (detail-adjacent fallbacks) */
export const MERCHANT_PRODUCTS_LIST_SELECT =
  'id, name, description, category, price, cost, original_price, image_url, additional_images, stock_quantity, sizes, colors, variants, is_active, archived_at, min_stock_level, discount_type, discount_value, discount_start_date, discount_end_date, created_at, updated_at';

export type MerchantProductSelectProfile = 'grid' | 'inventory' | 'full';

export const merchantProductSelectForProfile = (profile: MerchantProductSelectProfile = 'grid'): string => {
  if (profile === 'inventory') return MERCHANT_PRODUCTS_INVENTORY_SELECT;
  if (profile === 'full') return MERCHANT_PRODUCTS_LIST_SELECT;
  return MERCHANT_PRODUCTS_GRID_SELECT;
};

/** Standard select — archived_at included when migration applied; falls back if missing */
export const MERCHANT_PRODUCTS_STANDARD_SELECT =
  'id, name, description, category, price, cost, original_price, image_url, additional_images, stock_quantity, sizes, colors, variants, is_active, archived_at, min_stock_level, created_at, updated_at';

export const isSchemaColumnError = (message: string): boolean =>
  /column|schema cache|does not exist/i.test(message);

export type ProductInsertPayloads = {
  minimal: Record<string, unknown>;
  standard: Record<string, unknown>;
  extended: Record<string, unknown>;
  full: Record<string, unknown>;
};

export const buildProductInsertPayload = (
  product: Product,
  ownerId: string,
  storeId: string | null
): ProductInsertPayloads => {
  const minimal: Record<string, unknown> = {
    name: product.name,
    description: product.description || null,
    category: product.category,
    price: product.price,
    image_url: product.image,
    additional_images: product.additionalImages ?? [],
    owner_id: ownerId,
    is_active: product.isActive !== false,
    stock_quantity: product.stockQuantity ?? null,
  };

  const standard: Record<string, unknown> = {
    ...minimal,
    cost: product.cost ?? null,
    original_price: product.originalPrice ?? null,
    stock_quantity: product.stockQuantity ?? null,
    colors: product.colors ? JSON.parse(JSON.stringify(product.colors)) : null,
    sizes: product.sizes ?? null,
    variants: product.variants ? JSON.parse(JSON.stringify(product.variants)) : null,
    min_stock_level: product.lowStockThreshold ?? 3,
  };

  const extended: Record<string, unknown> = {
    ...standard,
    archived_at: product.archivedAt ?? null,
  };

  const full: Record<string, unknown> = {
    ...extended,
    sku: product.sku || null,
    short_description: product.shortDescription || null,
    seo_title: product.seoTitle || null,
    seo_description: product.seoDescription || null,
    product_slug: product.productSlug || null,
    tags: product.tags?.length ? product.tags : [],
    low_stock_threshold: product.lowStockThreshold ?? 3,
  };

  if (storeId) full.store_id = storeId;

  return { minimal, standard, extended, full };
};

/** @deprecated use ProductInsertPayloads */
export type LegacyProductInsertPayload = {
  core: Record<string, unknown>;
  full: Record<string, unknown>;
};

export const buildLegacyProductInsertPayload = (
  product: Product,
  ownerId: string,
  storeId: string | null
): LegacyProductInsertPayload => {
  const payloads = buildProductInsertPayload(product, ownerId, storeId);
  return { core: payloads.extended, full: payloads.full };
};

export const mapProductInsertError = (message: string): string => {
  const m = message.toLowerCase();
  if (m === 'forbidden') {
    return 'تعذر تنفيذ العملية — أعد تسجيل الدخول ثم حاول مرة أخرى';
  }
  if (m.includes('row-level security') || m.includes('policy')) {
    return 'ليس لديك صلاحية إضافة منتج — أعد تسجيل الدخول';
  }
  if (m.includes('foreign key') && m.includes('store_id')) {
    return 'متجرك غير مهيأ — افتح الإعدادات ثم حاول مرة أخرى';
  }
  if (isSchemaColumnError(message)) {
    return 'تعذر الحفظ — حدّث قاعدة البيانات عبر: supabase db push (المنتجات لم تُحذف، المشكلة في المزامنة)';
  }
  if (m.includes('duplicate') || m.includes('unique')) {
    return 'SKU أو رابط المنتج مستخدم مسبقاً';
  }
  return message;
};

export type ProductLifecycleAction = 'publish' | 'draft' | 'archive' | 'restore';

/** Whether a product patch changes dashboard catalog KPIs (product/low-stock counts). */
export const patchAffectsCatalogStats = (patch: Partial<Product>): boolean =>
  'stockQuantity' in patch ||
  'isActive' in patch ||
  'archivedAt' in patch ||
  'lowStockThreshold' in patch;

export const buildProductLifecyclePatch = (
  action: ProductLifecycleAction
): Partial<Product> => {
  switch (action) {
    case 'publish':
      return { isActive: true, archivedAt: null };
    case 'draft':
      return { isActive: false, archivedAt: null };
    case 'archive':
      return { isActive: false, archivedAt: new Date().toISOString() };
    case 'restore':
      return { isActive: false, archivedAt: null };
  }
};

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
  archivedAt: 'archivedAt' in patch ? (patch.archivedAt ?? undefined) : existing.archivedAt,
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
  archived_at: product.archivedAt ?? null,
});

/** Progressive update payloads — lifecycle-only last for publish/draft toggles */
export const buildProductUpdateAttempts = (product: Product): Record<string, unknown>[] => {
  const full = productToDbRow(product);
  const lifecycle = {
    is_active: product.isActive !== false,
    archived_at: product.archivedAt ?? null,
  };
  const publishOnly = { is_active: true, archived_at: null };
  return [full, lifecycle, publishOnly, { is_active: product.isActive !== false }];
};

/** Per-product low-stock threshold with sensible default */
export const getProductLowStockThreshold = (product: Pick<Product, 'lowStockThreshold' | 'stockQuantity'>): number =>
  product.lowStockThreshold ?? 5;

export const isProductLowStock = (product: Pick<Product, 'stockQuantity' | 'lowStockThreshold'>): boolean => {
  const qty = product.stockQuantity;
  if (qty === undefined || qty <= 0) return false;
  return qty <= getProductLowStockThreshold(product);
};
