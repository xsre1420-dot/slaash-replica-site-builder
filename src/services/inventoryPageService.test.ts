import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { Product } from '@/types';
import {
  loadInventoryPageBundle,
  peekInventoryPageBundle,
  catalogStatsFromInventorySummary,
} from '@/services/inventoryPageService';

const mockBundleRpc = vi.fn();

vi.mock('@/repositories/inventory/inventoryRepository', () => ({
  rpcGetMerchantInventoryPageBundle: (...args: unknown[]) => mockBundleRpc(...args),
}));

vi.mock('@/lib/supabase/schemaCapabilities', () => ({
  hasInventoryPageBundleRpc: vi.fn().mockResolvedValue(true),
}));

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
  mapMerchantInventorySummaryPayload: (p: Record<string, unknown>) =>
    p?.success
      ? {
          totalProducts: Number(p.total_products ?? 0),
          published: Number(p.published ?? 0),
          draft: Number(p.draft ?? 0),
          archived: Number(p.archived ?? 0),
          totalUnits: Number(p.total_units ?? 0),
          retailValue: Number(p.retail_value ?? 0),
          costValue: Number(p.cost_value ?? 0),
          missingSku: Number(p.missing_sku ?? 0),
          missingBarcode: Number(p.missing_barcode ?? 0),
          missingImage: Number(p.missing_image ?? 0),
          lowStock: Number(p.low_stock ?? 0),
          outOfStock: Number(p.out_of_stock ?? 0),
          incomingUnits: Number(p.incoming_units ?? 0),
          reservedUnits: Number(p.reserved_units ?? 0),
        }
      : null,
}));

vi.mock('@/services/reviewService', () => ({
  countPendingReviewsForOwner: vi.fn().mockResolvedValue(3),
}));

describe('inventoryPageService', () => {
  beforeEach(() => {
    cache.flushAll();
    vi.clearAllMocks();
    mockBundleRpc.mockResolvedValue({
      data: {
        success: true,
        categories: [{ id: 'c1', name: 'Electronics', display_order: 0 }],
        products: [{ id: 'p1', name: 'Item', price: 1000, category: 'Electronics' }],
        total: 1,
        has_more: false,
        next_cursor: null,
        pending_reviews_count: 3,
        summary: {
          success: true,
          total_products: 10,
          published: 8,
          draft: 1,
          archived: 1,
          total_units: 100,
          retail_value: 50000,
          cost_value: 30000,
          missing_sku: 0,
          missing_barcode: 0,
          missing_image: 0,
          low_stock: 2,
          out_of_stock: 1,
          incoming_units: 0,
          reserved_units: 0,
        },
      },
      error: null,
    });
  });

  it('peekInventoryPageBundle returns null when cache is cold', () => {
    expect(peekInventoryPageBundle('owner-1')).toBeNull();
  });

  it('loadInventoryPageBundle uses bundle RPC on cold load', async () => {
    const bundle = await loadInventoryPageBundle('owner-1');
    expect(mockBundleRpc).toHaveBeenCalled();
    expect(bundle.categories).toHaveLength(1);
    expect(bundle.pendingReviewsCount).toBe(3);
    expect(bundle.products).toHaveLength(1);
    expect(peekInventoryPageBundle('owner-1')?.total).toBe(1);
  });

  it('loadInventoryPageBundle dedupes concurrent loads', async () => {
    const [a, b] = await Promise.all([
      loadInventoryPageBundle('owner-1'),
      loadInventoryPageBundle('owner-1'),
    ]);

    expect(a.categories).toHaveLength(1);
    expect(a.pendingReviewsCount).toBe(3);
    expect(b.products).toHaveLength(1);
    expect(mockBundleRpc).toHaveBeenCalledTimes(1);
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
