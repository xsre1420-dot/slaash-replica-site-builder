import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { Product } from '@/types';
import {
  loadInventoryPageBundle,
  peekInventoryPageBundle,
  catalogStatsFromInventorySummary,
} from '@/services/inventoryPageService';

vi.mock('@/services/productService', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Electronics', order: 0 }]),
  getCategoriesSync: vi.fn().mockReturnValue([{ id: 'c1', name: 'Electronics', order: 0 }]),
  loadProductsPage: vi.fn().mockResolvedValue({
    products: [{ id: 'p1', name: 'Item', price: 1000, category: 'Electronics' } as Product],
    total: 1,
    hasMore: false,
    nextCursor: null,
  }),
  PRODUCTS_PAGE_SIZE: 50,
}));

vi.mock('@/services/inventoryService', () => ({
  fetchMerchantInventorySummary: vi.fn().mockResolvedValue({
    totalProducts: 10,
    published: 8,
    draft: 1,
    archived: 1,
    totalUnits: 100,
    retailValue: 50000,
    costValue: 30000,
    missingSku: 0,
    missingBarcode: 0,
    missingImage: 0,
    lowStock: 2,
    outOfStock: 1,
    incomingUnits: 0,
    reservedUnits: 0,
  }),
}));

vi.mock('@/services/reviewService', () => ({
  countPendingReviewsForOwner: vi.fn().mockResolvedValue(3),
}));

describe('inventoryPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
  });

  it('peekInventoryPageBundle returns null when cache is cold', () => {
    expect(peekInventoryPageBundle('owner-1')).toBeNull();
  });

  it('loadInventoryPageBundle dedupes concurrent loads', async () => {
    const [a, b] = await Promise.all([
      loadInventoryPageBundle('owner-1'),
      loadInventoryPageBundle('owner-1'),
    ]);

    expect(a.categories).toHaveLength(1);
    expect(a.pendingReviewsCount).toBe(3);
    expect(b.products).toHaveLength(1);
    expect(peekInventoryPageBundle('owner-1')?.total).toBe(1);
  });

  it('catalogStatsFromInventorySummary maps RPC summary to stat cards', () => {
    const stats = catalogStatsFromInventorySummary({
      totalProducts: 10,
      published: 8,
      draft: 1,
      archived: 1,
      totalUnits: 100,
      retailValue: 50000,
      costValue: 30000,
      missingSku: 0,
      missingBarcode: 0,
      missingImage: 0,
      lowStock: 2,
      outOfStock: 1,
      incomingUnits: 0,
      reservedUnits: 0,
    });

    expect(stats.lowStock).toBe(2);
    expect(stats.outOfStock).toBe(1);
    expect(stats.inventoryValue).toBe(50000);
    expect(stats.inStock).toBe(5);
  });
});
