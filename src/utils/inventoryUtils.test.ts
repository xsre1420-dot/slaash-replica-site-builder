import { describe, it, expect } from 'vitest';
import {
  getAvailableQty,
  computeDiscountedPrice,
  applyActiveDiscount,
  scaleVariantsToTotal,
  normalizeProductStock,
} from '@/utils/inventoryUtils';
import { Product } from '@/types';

const baseProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Item',
  description: '',
  category: 'c',
  price: 1000,
  image: '',
  stockQuantity: 10,
  ...overrides,
});

describe('inventoryUtils', () => {
  it('returns aggregate stock without variants', () => {
    expect(getAvailableQty(baseProduct({ stockQuantity: 7 }))).toBe(7);
  });

  it('caps variant qty by aggregate stock', () => {
    const product = baseProduct({
      stockQuantity: 5,
      variants: [{ size: 'M', color: 'red', quantity: 20 }],
    });
    expect(getAvailableQty(product, 'M', 'red')).toBe(5);
  });

  it('uses aggregate stock when variant rows are zero', () => {
    const product = baseProduct({
      stockQuantity: 25,
      sizes: ['M', 'L'],
      variants: [
        { size: 'M', quantity: 0 },
        { size: 'L', quantity: 0 },
      ],
    });
    expect(getAvailableQty(product)).toBe(25);
    expect(getAvailableQty(product, 'M')).toBe(25);
  });

  it('returns zero only when aggregate and variants are empty', () => {
    const product = baseProduct({
      stockQuantity: 0,
      variants: [{ size: 'M', quantity: 0 }],
    });
    expect(getAvailableQty(product, 'M')).toBe(0);
  });

  it('trusts variant qty when aggregate stock_quantity is zero (drift)', () => {
    const product = baseProduct({
      stockQuantity: 0,
      variants: [{ size: 'M', quantity: 12 }],
    });
    expect(getAvailableQty(product, 'M')).toBe(12);
  });

  it('distributes stock evenly when rescaling from zero variants', () => {
    const scaled = scaleVariantsToTotal(
      [
        { size: 'S', quantity: 0 },
        { size: 'M', quantity: 0 },
        { size: 'L', quantity: 0 },
      ],
      10
    );
    expect(scaled.reduce((s, v) => s + v.quantity, 0)).toBe(10);
    expect(scaled.every((v) => v.quantity > 0)).toBe(true);
  });

  it('normalizeProductStock drops zero-qty variants when aggregate has stock', () => {
    const normalized = normalizeProductStock(
      baseProduct({
        stockQuantity: 12,
        variants: [
          { size: 'M', quantity: 0 },
          { size: 'L', quantity: 0 },
        ],
      })
    );
    expect(normalized.stockQuantity).toBe(12);
    expect(normalized.variants).toBeUndefined();
  });

  it('computes percentage discount when active', () => {
    const product = baseProduct({
      price: 1000,
      originalPrice: 1000,
      discountType: 'percentage',
      discountValue: 10,
      discountStartDate: '2020-01-01T00:00:00Z',
      discountEndDate: '2099-12-31T23:59:59Z',
    });
    expect(computeDiscountedPrice(product)).toBe(900);
    expect(applyActiveDiscount(product).price).toBe(900);
  });
});
