import { describe, it, expect } from 'vitest';
import {
  getChangedFieldKeys,
  isNoiseOnlyChange,
  isStockOnlyStorefrontChange,
  shouldInvalidateStorefront,
  PRODUCT_NOISE_FIELDS,
} from './merchantRealtimeUtils';

describe('merchantRealtimeUtils', () => {
  it('detects changed keys between old and new rows', () => {
    expect(
      getChangedFieldKeys(
        { id: '1', stock_quantity: 5, updated_at: 'b' },
        { id: '1', stock_quantity: 3, updated_at: 'a' }
      )
    ).toEqual(['stock_quantity', 'updated_at']);
  });

  it('treats updated_at-only product changes as noise', () => {
    const changed = getChangedFieldKeys({ updated_at: 'b' }, { updated_at: 'a' });
    expect(isNoiseOnlyChange(changed, PRODUCT_NOISE_FIELDS)).toBe(true);
  });

  it('treats min_stock_level-only changes as noise', () => {
    const changed = getChangedFieldKeys({ min_stock_level: 8 }, { min_stock_level: 5 });
    expect(isNoiseOnlyChange(changed, PRODUCT_NOISE_FIELDS)).toBe(true);
  });

  it('treats seo and cost-only changes as noise', () => {
    const changed = getChangedFieldKeys(
      { seo_title: 'a', cost: 10 },
      { seo_title: 'b', cost: 12 }
    );
    expect(isNoiseOnlyChange(changed, PRODUCT_NOISE_FIELDS)).toBe(true);
  });

  it('does not treat stock changes as noise', () => {
    const changed = getChangedFieldKeys(
      { stock_quantity: 2, updated_at: 'b' },
      { stock_quantity: 1, updated_at: 'a' }
    );
    expect(isNoiseOnlyChange(changed, PRODUCT_NOISE_FIELDS)).toBe(false);
  });

  it('invalidates storefront when stock or visibility fields change', () => {
    expect(
      shouldInvalidateStorefront({
        eventType: 'UPDATE',
        new: { stock_quantity: 1 },
        old: { stock_quantity: 0 },
      })
    ).toBe(true);

    expect(
      shouldInvalidateStorefront({
        eventType: 'UPDATE',
        new: { seo_title: 'x' },
        old: { seo_title: 'y' },
      })
    ).toBe(false);
  });

  it('detects stock-only storefront changes for selective cache patch', () => {
    expect(isStockOnlyStorefrontChange(['stock_quantity'])).toBe(true);
    expect(isStockOnlyStorefrontChange(['stock_quantity', 'variants'])).toBe(true);
    expect(isStockOnlyStorefrontChange(['stock_quantity', 'name'])).toBe(false);
  });
});
