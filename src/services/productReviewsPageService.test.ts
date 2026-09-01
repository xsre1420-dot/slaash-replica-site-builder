import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '@/lib/cache';
import { Product } from '@/types';
import {
  loadProductReviewsPageBundle,
  peekProductReviewsPageBundle,
  invalidateProductReviewsPageBundle,
} from '@/services/productReviewsPageService';

const mockProduct = {
  id: 'p1',
  name: 'Reviewed Product',
  price: 1000,
  category: 'Electronics',
  image: 'https://cdn/img.jpg',
} as Product;

const mockReviews = [
  {
    id: 'r1',
    reviewer_name: 'Ali',
    rating: 5,
    comment: 'Great',
    is_approved: false,
    is_featured: false,
    helpful_count: 0,
    created_at: '2026-01-01T00:00:00Z',
  },
];

vi.mock('@/services/productService', () => ({
  fetchProductById: vi.fn(async (id: string) => (id === 'p1' ? mockProduct : null)),
}));

vi.mock('@/services/reviewService', () => ({
  fetchMerchantProductReviews: vi.fn(async () => mockReviews),
}));

describe('productReviewsPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekProductReviewsPageBundle returns null when cache is cold', () => {
    expect(peekProductReviewsPageBundle('owner-1', 'p1')).toBeNull();
  });

  it('loadProductReviewsPageBundle loads product meta and reviews together', async () => {
    const bundle = await loadProductReviewsPageBundle('owner-1', 'p1');

    expect(bundle?.productName).toBe('Reviewed Product');
    expect(bundle?.reviews).toHaveLength(1);
    expect(peekProductReviewsPageBundle('owner-1', 'p1')?.reviews[0].id).toBe('r1');
  });

  it('loadProductReviewsPageBundle dedupes concurrent loads', async () => {
    const [a, b] = await Promise.all([
      loadProductReviewsPageBundle('owner-1', 'p1'),
      loadProductReviewsPageBundle('owner-1', 'p1'),
    ]);

    expect(a?.productId).toBe('p1');
    expect(b?.reviews).toHaveLength(1);
  });

  it('invalidateProductReviewsPageBundle clears cached bundle', async () => {
    await loadProductReviewsPageBundle('owner-1', 'p1');
    invalidateProductReviewsPageBundle('owner-1', 'p1');
    expect(peekProductReviewsPageBundle('owner-1', 'p1')).toBeNull();
  });
});
