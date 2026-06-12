import { useMemo } from 'react';
import { Product } from '@/types';

export type ProductSortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc';

export interface ProductFilterOptions {
  search?: string;
  category?: string;
  sortBy?: ProductSortOption;
  priceRange?: [number, number];
  sizes?: string[];
}

const sortProducts = (products: Product[], sortBy: ProductSortOption): Product[] => {
  const list = [...products];
  switch (sortBy) {
    case 'price-asc':
      return list.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return list.sort((a, b) => b.price - a.price);
    case 'name-asc':
      return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    default:
      return list;
  }
};

/** Phase 2: Shared product filtering — used by Store & PreviewStore */
export const useProductFiltering = (
  products: Product[],
  {
    search = '',
    category = 'all',
    sortBy = 'default',
    priceRange,
    sizes = [],
  }: ProductFilterOptions
) => {
  return useMemo(() => {
    let list = products;

    if (category && category !== 'all') {
      list = list.filter((p) => p.category === category);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }

    if (priceRange && priceRange[1] > 0) {
      list = list.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);
    }

    if (sizes.length > 0) {
      list = list.filter((p) => p.sizes?.some((s) => sizes.includes(s)));
    }

    return sortProducts(list, sortBy);
  }, [products, search, category, sortBy, priceRange, sizes]);
};
