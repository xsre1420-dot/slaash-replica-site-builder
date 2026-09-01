import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '@/lib/cache';
import {
  loadPreviewStorePageBundle,
  peekPreviewStorePageBundle,
  invalidatePreviewStorePageBundle,
  previewCategoriesWithAll,
} from '@/services/previewStorePageService';

const mockCategories = [{ id: 'c1', name: 'Electronics', order: 0 }];
const mockProducts = [
  {
    id: 'p1',
    name: 'Phone',
    price: 100000,
    category: 'Electronics',
    image: '/phone.jpg',
  },
];

vi.mock('@/services/productService', () => ({
  PRODUCTS_PAGE_SIZE: 50,
  getCategoriesSync: vi.fn(() => mockCategories),
  getCategories: vi.fn(async () => mockCategories),
  loadProductsPage: vi.fn(async () => ({
    products: mockProducts,
    total: 1,
    hasMore: false,
    nextCursor: null,
  })),
}));

vi.mock('@/services/storeService', () => ({
  bootstrapOwnerStore: vi.fn(async () => ({ storeId: 'store-1', productsLoaded: 1, categoriesLoaded: 1 })),
}));

vi.mock('@/services/storefrontProductService', () => ({
  resolveStoreSlugByOwnerId: vi.fn(async () => 'my-shop'),
}));

describe('previewStorePageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekPreviewStorePageBundle returns null when cache is cold', () => {
    expect(peekPreviewStorePageBundle('owner-1')).toBeNull();
  });

  it('loadPreviewStorePageBundle dedupes concurrent loads and caches bundle', async () => {
    const [a, b] = await Promise.all([
      loadPreviewStorePageBundle('owner-1'),
      loadPreviewStorePageBundle('owner-1'),
    ]);

    expect(a.categories).toHaveLength(1);
    expect(a.products).toHaveLength(1);
    expect(a.storeSlug).toBe('my-shop');
    expect(b.total).toBe(1);
    expect(peekPreviewStorePageBundle('owner-1')?.storeSlug).toBe('my-shop');
  });

  it('previewCategoriesWithAll prepends the all chip', () => {
    const chips = previewCategoriesWithAll(mockCategories);
    expect(chips[0].id).toBe('all');
    expect(chips).toHaveLength(2);
  });

  it('invalidatePreviewStorePageBundle clears cached bundle', async () => {
    await loadPreviewStorePageBundle('owner-2');
    invalidatePreviewStorePageBundle('owner-2');
    expect(peekPreviewStorePageBundle('owner-2')).toBeNull();
  });
});
