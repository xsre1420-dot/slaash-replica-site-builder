import { Product } from '@/types';

export type ProductLifecycleStatus = 'published' | 'draft' | 'archived';

export type ProductLifecycleFilter = 'all' | ProductLifecycleStatus;

export const getProductLifecycleStatus = (
  product: Pick<Product, 'isActive' | 'archivedAt'>
): ProductLifecycleStatus => {
  if (product.archivedAt) return 'archived';
  if (product.isActive === false) return 'draft';
  return 'published';
};

export const matchesLifecycleFilter = (
  product: Product,
  filter: ProductLifecycleFilter
): boolean => filter === 'all' || getProductLifecycleStatus(product) === filter;

export const lifecycleStatusLabel: Record<ProductLifecycleStatus, string> = {
  published: 'منشور',
  draft: 'مسودة',
  archived: 'مؤرشف',
};

export const isStorefrontVisible = (product: Pick<Product, 'isActive' | 'archivedAt'>): boolean =>
  getProductLifecycleStatus(product) === 'published';
