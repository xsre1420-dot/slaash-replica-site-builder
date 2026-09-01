import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '@/lib/cache';
import { Product } from '@/types';
import {
  loadProductDetailPageBundle,
  peekProductDetailPageBundle,
  invalidateProductDetailPageBundle,
  mergeProductDetailStock,
} from '@/services/productDetailPageService';

const mockProduct: Product = {
  id: 'p1',
  name: 'Phone',
  price: 100000,
  category: 'Electronics',
  description: 'Full desc',
  image: 'https://cdn/a.jpg',
  stockQuantity: 5,
};

vi.mock('@/services/storefrontProductService', () => ({
  loadProductDetailBundle: vi.fn(async () => mockProduct),
}));

vi.mock('@/services/productService', () => ({
  fetchProductById: vi.fn(async () => mockProduct),
  getProductById: vi.fn(() => mockProduct),
}));

vi.mock('@/services/storefrontReviewService', () => ({
  fetchApprovedReviewsForStore: vi.fn(async () => [
    {
      id: 'r1',
      reviewer_name: 'Ali',
      rating: 5,
      comment: 'Great',
      created_at: '2026-01-01T00:00:00Z',
      helpful_count: 2,
    },
  ]),
  fetchApprovedReviewsForOwner: vi.fn(async () => []),
}));

vi.mock('@/services/suggestedProductsService', () => ({
  fetchSuggestedProductsForStore: vi.fn(async () => [
    { id: 'p2', name: 'Case', price: 5000, category: 'Accessories', image_url: '/case.jpg' },
  ]),
  fetchSuggestedProductsForOwner: vi.fn(async () => [
    { id: 'p3', name: 'Cable', price: 3000, category: 'Accessories', image_url: '/cable.jpg' },
  ]),
}));

describe('productDetailPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekProductDetailPageBundle returns null when cache is cold', () => {
    expect(peekProductDetailPageBundle('p1', { storeSlug: 'demo' })).toBeNull();
  });

  it('loadProductDetailPageBundle dedupes storefront loads', async () => {
    const [a, b] = await Promise.all([
      loadProductDetailPageBundle('p1', { storeSlug: 'demo' }),
      loadProductDetailPageBundle('p1', { storeSlug: 'demo' }),
    ]);

    expect(a.product?.id).toBe('p1');
    expect(a.reviews).toHaveLength(1);
    expect(a.suggestedProducts).toHaveLength(1);
    expect(b.reviews[0].name).toBe('Ali');
    expect(peekProductDetailPageBundle('p1', { storeSlug: 'demo' })?.product?.name).toBe('Phone');
  });

  it('loadProductDetailPageBundle loads merchant preview bundle', async () => {
    const bundle = await loadProductDetailPageBundle('p1', { ownerId: 'owner-1' });
    expect(bundle.product?.id).toBe('p1');
    expect(bundle.suggestedProducts[0].name).toBe('Cable');
  });

  it('mergeProductDetailStock preserves richer cached gallery when fresh is sparse', () => {
    const merged = mergeProductDetailStock(
      { ...mockProduct, additionalImages: ['https://cdn/b.jpg', 'https://cdn/c.jpg'] },
      { ...mockProduct, additionalImages: [] }
    );
    expect(merged.additionalImages).toHaveLength(2);
  });

  it('invalidateProductDetailPageBundle clears cache', async () => {
    await loadProductDetailPageBundle('p1', { storeSlug: 'shop' });
    invalidateProductDetailPageBundle({ storeSlug: 'shop' }, 'p1');
    expect(peekProductDetailPageBundle('p1', { storeSlug: 'shop' })).toBeNull();
  });
});
