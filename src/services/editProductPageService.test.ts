import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { Product } from '@/types';
import {
  loadEditProductPageBundle,
  peekEditProductPageBundle,
  invalidateEditProductPageBundle,
} from '@/services/editProductPageService';

const mockProduct = {
  id: 'p1',
  name: 'Test Product',
  price: 1000,
  category: 'Electronics',
  image: 'https://cdn/img.jpg',
} as Product;

vi.mock('@/services/productService', () => ({
  fetchProductById: vi.fn(async (id: string) => (id === 'p1' ? mockProduct : null)),
  getCategories: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Electronics', order: 0 }]),
  getCategoriesSync: vi.fn().mockReturnValue([]),
}));

describe('editProductPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekEditProductPageBundle returns null when cache is cold', () => {
    expect(peekEditProductPageBundle('owner-1', 'p1')).toBeNull();
  });

  it('loadEditProductPageBundle dedupes concurrent loads', async () => {
    const [a, b] = await Promise.all([
      loadEditProductPageBundle('owner-1', 'p1'),
      loadEditProductPageBundle('owner-1', 'p1'),
    ]);

    expect(a?.product.name).toBe('Test Product');
    expect(b?.categories).toHaveLength(1);
    expect(peekEditProductPageBundle('owner-1', 'p1')?.product.id).toBe('p1');
  });

  it('invalidateEditProductPageBundle clears cached bundle', async () => {
    await loadEditProductPageBundle('owner-1', 'p1');
    invalidateEditProductPageBundle('owner-1', 'p1');
    expect(peekEditProductPageBundle('owner-1', 'p1')).toBeNull();
  });
});
