import { describe, expect, it } from 'vitest';
import {
  computeInventoryStats,
  filterInventoryProducts,
  getInventoryStockStatus,
  sortInventoryProducts,
  getSuggestedRestockAmount,
  summarizeMovements,
  toInventoryProduct,
  type InventoryProductRow,
} from './inventoryPageUtils';

const baseRow = (overrides: Partial<InventoryProductRow> = {}): InventoryProductRow => ({
  id: '1',
  name: 'منتج',
  price: 1000,
  category: 'ملابس',
  stock_quantity: 10,
  min_stock_level: 5,
  created_at: '2026-01-01T00:00:00Z',
  lifecycle: 'published',
  ...overrides,
});

describe('inventoryPageUtils', () => {
  it('uses archived_at for archived lifecycle rows', () => {
    const row = baseRow({
      lifecycle: 'archived',
      created_at: '2026-01-01T00:00:00Z',
      archived_at: '2026-06-01T12:00:00Z',
    });
    expect(toInventoryProduct(row).archivedAt).toBe('2026-06-01T12:00:00Z');
  });

  it('marks low stock when at min threshold', () => {
    expect(getInventoryStockStatus(baseRow({ stock_quantity: 5 })).status).toBe('low');
  });

  it('marks draft products as not sellable out', () => {
    const status = getInventoryStockStatus(baseRow({ lifecycle: 'draft', stock_quantity: 20 }));
    expect(status.status).toBe('out');
    expect(status.label).toBe('غير معروض للبيع');
  });

  it('computes inventory value from available qty', () => {
    const stats = computeInventoryStats([
      baseRow({ stock_quantity: 2, price: 500 }),
      baseRow({ id: '2', stock_quantity: 3, price: 1000 }),
    ]);
    expect(stats.totalStock).toBe(5);
    expect(stats.inventoryValue).toBe(4000);
  });

  it('filters by lifecycle and low-stock-only', () => {
    const products = [
      baseRow({ id: '1', stock_quantity: 0 }),
      baseRow({ id: '2', stock_quantity: 20 }),
      baseRow({ id: '3', lifecycle: 'draft', stock_quantity: 10 }),
    ];

    const lowOnly = filterInventoryProducts(products, {
      search: '',
      stockFilter: 'all',
      category: 'all',
      lifecycle: 'published',
      lowStockOnly: true,
    });

    expect(lowOnly.map((p) => p.id)).toEqual(['1']);
  });

  it('sorts by stock ascending', () => {
    const products = [
      baseRow({ id: 'a', stock_quantity: 20 }),
      baseRow({ id: 'b', stock_quantity: 2 }),
    ];
    const sorted = sortInventoryProducts(products, 'stock_asc');
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('suggests restock to reach safe level when low', () => {
    expect(getSuggestedRestockAmount(baseRow({ stock_quantity: 2, min_stock_level: 5 }))).toBe(8);
    expect(getSuggestedRestockAmount(baseRow({ stock_quantity: 20, min_stock_level: 5 }))).toBe(10);
  });

  it('summarizes movement deltas', () => {
    const summary = summarizeMovements([
      { id: '1', quantity_delta: 10, reason: 'restock', created_at: '2026-01-01' },
      { id: '2', quantity_delta: -3, reason: 'order_created', created_at: '2026-01-02' },
    ]);
    expect(summary).toEqual({ added: 10, removed: 3, net: 7 });
  });
});
