import { describe, expect, it } from 'vitest';
import { computeMerchantInventorySummaryFromProducts } from '@/lib/inventory/simpleInventorySummary';
import { INVENTORY_MODEL } from '@/lib/inventory/inventoryArchitecture';
import type { Product } from '@/types';

describe('simpleInventorySummary', () => {
  const base = (overrides: Partial<Product>): Product => ({
    id: 'p1',
    name: 'Item',
    description: '',
    category: 'c',
    price: 1000,
    image: '',
    ...overrides,
  });

  it('documents simple inventory as production model', () => {
    expect(INVENTORY_MODEL).toBe('simple');
  });

  it('computes low/out stock counts from products', () => {
    const summary = computeMerchantInventorySummaryFromProducts([
      base({ id: 'a', stockQuantity: 0, isActive: true }),
      base({ id: 'b', stockQuantity: 2, lowStockThreshold: 5, isActive: true }),
      base({ id: 'c', stockQuantity: 20, isActive: true }),
      base({ id: 'd', isActive: false }),
      base({ id: 'e', archivedAt: new Date().toISOString() }),
    ]);

    expect(summary.published).toBe(3);
    expect(summary.draft).toBe(1);
    expect(summary.archived).toBe(1);
    expect(summary.outOfStock).toBe(1);
    expect(summary.lowStock).toBe(1);
    expect(summary.incomingUnits).toBe(0);
  });

  it('aggregates retail value from stock and price', () => {
    const summary = computeMerchantInventorySummaryFromProducts([
      base({ stockQuantity: 5, price: 100, isActive: true }),
      base({ id: 'p2', stockQuantity: 2, price: 50, isActive: true }),
    ]);
    expect(summary.retailValue).toBe(600);
    expect(summary.totalUnits).toBe(7);
  });
});
