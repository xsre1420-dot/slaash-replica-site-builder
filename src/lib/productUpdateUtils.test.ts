import { describe, it, expect } from 'vitest';
import { mergeProductForUpdate, isProductLowStock, getProductLowStockThreshold } from './productUpdateUtils';
import { Product } from '@/types';

const base: Product = {
  id: 'p1',
  name: 'Test',
  description: 'Desc',
  category: 'Cat',
  price: 100,
  cost: 40,
  image: 'https://example.com/a.jpg',
  stockQuantity: 10,
  variants: [{ size: 'M', quantity: 5 }],
  sku: 'SKU-1',
  seoTitle: 'SEO',
  lowStockThreshold: 3,
  isActive: true,
};

describe('mergeProductForUpdate', () => {
  it('preserves variants and stock when patch omits them', () => {
    const merged = mergeProductForUpdate(base, { name: 'Updated', price: 120 });
    expect(merged.name).toBe('Updated');
    expect(merged.price).toBe(120);
    expect(merged.variants).toEqual(base.variants);
    expect(merged.stockQuantity).toBe(10);
    expect(merged.cost).toBe(40);
    expect(merged.sku).toBe('SKU-1');
  });

  it('allows explicit nulling via undefined vs explicit empty', () => {
    const merged = mergeProductForUpdate(base, { sizes: undefined });
    expect(merged.sizes).toBeUndefined();
  });
});

describe('isProductLowStock', () => {
  it('uses per-product threshold', () => {
    expect(isProductLowStock({ stockQuantity: 3, lowStockThreshold: 5 })).toBe(true);
    expect(isProductLowStock({ stockQuantity: 10, lowStockThreshold: 5 })).toBe(false);
  });

  it('defaults threshold to 5', () => {
    expect(getProductLowStockThreshold({})).toBe(5);
  });
});
