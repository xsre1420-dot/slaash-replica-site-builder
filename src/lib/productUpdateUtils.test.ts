import { describe, it, expect } from 'vitest';
import { buildProductInsertPayload, buildProductLifecyclePatch, mergeProductForUpdate, isProductLowStock, getProductLowStockThreshold, patchAffectsCatalogStats } from './productUpdateUtils';
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

describe('buildProductInsertPayload', () => {
  it('sets is_active false for drafts and true when published', () => {
    const draft = buildProductInsertPayload(
      { ...base, id: '', isActive: false },
      'owner-1',
      'store-1'
    );
    expect(draft.full.is_active).toBe(false);
    expect(draft.minimal.is_active).toBe(false);
    expect(draft.full.store_id).toBe('store-1');
    expect(draft.minimal.owner_id).toBe('owner-1');
    expect(draft.minimal).not.toHaveProperty('archived_at');

    const published = buildProductInsertPayload(
      { ...base, id: '', isActive: true },
      'owner-1',
      null
    );
    expect(published.full.is_active).toBe(true);
    expect(published.full.store_id).toBeUndefined();
  });
});

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

  it('clears archivedAt when publishing from archived state', () => {
    const archived = { ...base, isActive: false, archivedAt: '2026-01-01T00:00:00Z' };
    const merged = mergeProductForUpdate(archived, buildProductLifecyclePatch('publish'));
    expect(merged.isActive).toBe(true);
    expect(merged.archivedAt).toBeUndefined();
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

describe('patchAffectsCatalogStats', () => {
  it('is false for metadata-only patches', () => {
    expect(patchAffectsCatalogStats({ name: 'New' })).toBe(false);
    expect(patchAffectsCatalogStats({ price: 99 })).toBe(false);
  });

  it('is true when stock, lifecycle, or threshold changes', () => {
    expect(patchAffectsCatalogStats({ stockQuantity: 5 })).toBe(true);
    expect(patchAffectsCatalogStats({ isActive: false })).toBe(true);
    expect(patchAffectsCatalogStats({ archivedAt: '2026-01-01' })).toBe(true);
    expect(patchAffectsCatalogStats({ lowStockThreshold: 2 })).toBe(true);
  });
});
