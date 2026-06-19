import { Product } from '@/types';
import { isProductLowStock } from '@/lib/productUpdateUtils';
import {
  getProductLifecycleStatus,
  matchesLifecycleFilter,
  type ProductLifecycleFilter,
} from '@/lib/productLifecycle';

export type ProductStockFilter = 'all' | 'in_stock' | 'low' | 'out';
export type ProductCatalogSort =
  | 'recent'
  | 'name'
  | 'price_asc'
  | 'price_desc'
  | 'stock_asc'
  | 'stock_desc';

export type ProductCatalogFilters = {
  search: string;
  category: string;
  stock: ProductStockFilter;
  lifecycle: ProductLifecycleFilter;
  sort: ProductCatalogSort;
};

export const DEFAULT_PRODUCT_CATALOG_FILTERS: ProductCatalogFilters = {
  search: '',
  category: 'all',
  stock: 'all',
  lifecycle: 'all',
  sort: 'recent',
};

export type ProductLifecycleCounts = Record<ProductLifecycleFilter, number>;

export const computeProductCatalogStats = (products: Product[]) => {
  let published = 0;
  let drafts = 0;
  let archived = 0;
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let inventoryValue = 0;

  for (const p of products) {
    const lifecycle = getProductLifecycleStatus(p);
    if (lifecycle === 'published') published += 1;
    else if (lifecycle === 'draft') drafts += 1;
    else archived += 1;

    const qty = p.stockQuantity ?? 0;
    if (p.stockQuantity !== undefined && qty === 0) outOfStock += 1;
    else if (isProductLowStock(p)) lowStock += 1;
    else if (qty > 0) inStock += 1;

    inventoryValue += p.price * Math.max(qty, 0);
  }

  return {
    total: products.length,
    published,
    drafts,
    archived,
    inStock,
    lowStock,
    outOfStock,
    inventoryValue,
  };
};

export const countProductsByLifecycle = (products: Product[]): ProductLifecycleCounts => ({
  all: products.length,
  published: products.filter((p) => getProductLifecycleStatus(p) === 'published').length,
  draft: products.filter((p) => getProductLifecycleStatus(p) === 'draft').length,
  archived: products.filter((p) => getProductLifecycleStatus(p) === 'archived').length,
});

const matchesStockFilter = (product: Product, stock: ProductStockFilter): boolean => {
  if (stock === 'all') return true;
  if (stock === 'in_stock') return !isProductLowStock(product) && (product.stockQuantity ?? 0) > 0;
  if (stock === 'low') return isProductLowStock(product);
  return product.stockQuantity !== undefined && product.stockQuantity === 0;
};

export const filterProductCatalog = (
  products: Product[],
  filters: Pick<ProductCatalogFilters, 'search' | 'category' | 'stock' | 'lifecycle'>
): Product[] => {
  const q = filters.search.trim().toLowerCase();

  return products.filter((p) => {
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q);

    const matchesCategory = filters.category === 'all' || p.category === filters.category;
    const matchesLifecycle = matchesLifecycleFilter(p, filters.lifecycle);
    const matchesStock = matchesStockFilter(p, filters.stock);

    return matchesSearch && matchesCategory && matchesLifecycle && matchesStock;
  });
};

export const sortProductCatalog = (products: Product[], sort: ProductCatalogSort): Product[] => {
  const copy = [...products];

  copy.sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name, 'ar');
      case 'price_asc':
        return a.price - b.price;
      case 'price_desc':
        return b.price - a.price;
      case 'stock_asc':
        return (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0);
      case 'stock_desc':
        return (b.stockQuantity ?? 0) - (a.stockQuantity ?? 0);
      case 'recent':
      default:
        return 0;
    }
  });

  return copy;
};

export const applyProductCatalogFilters = (
  products: Product[],
  filters: ProductCatalogFilters
): Product[] => sortProductCatalog(filterProductCatalog(products, filters), filters.sort);

export const getUniqueProductCategories = (products: Product[]): string[] =>
  [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ar')
  );

export const PRODUCT_LIFECYCLE_TABS: { id: ProductLifecycleFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'published', label: 'منشور' },
  { id: 'draft', label: 'مسودات' },
  { id: 'archived', label: 'مؤرشف' },
];

export const PRODUCT_SORT_OPTIONS: { value: ProductCatalogSort; label: string }[] = [
  { value: 'recent', label: 'الأحدث' },
  { value: 'name', label: 'الاسم' },
  { value: 'price_desc', label: 'السعر: الأعلى' },
  { value: 'price_asc', label: 'السعر: الأقل' },
  { value: 'stock_asc', label: 'المخزون: الأقل' },
  { value: 'stock_desc', label: 'المخزون: الأعلى' },
];

/** Readable inventory value for stat cards (IQD). */
export const formatProductInventoryValue = (value: number): string => {
  if (value <= 0) return '0 د.ع';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const formatted =
      millions >= 10
        ? Math.round(millions).toLocaleString('ar-IQ')
        : millions.toLocaleString('ar-IQ', { maximumFractionDigits: 1 });
    return `${formatted}M د.ع`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 1000).toLocaleString('ar-IQ')}k د.ع`;
  }
  return `${value.toLocaleString('ar-IQ')} د.ع`;
};
