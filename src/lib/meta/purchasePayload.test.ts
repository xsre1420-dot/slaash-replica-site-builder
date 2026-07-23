import { describe, expect, it } from 'vitest';
import { buildMetaPurchaseContents } from './purchasePayload';

describe('buildMetaPurchaseContents', () => {
  it('aggregates quantities per product id', () => {
    const result = buildMetaPurchaseContents([
      { productId: 'a', quantity: 2 },
      { productId: 'b', quantity: 1 },
      { productId: 'a', quantity: 3 },
    ]);
    expect(result.contents).toEqual([
      { id: 'a', quantity: 5 },
      { id: 'b', quantity: 1 },
    ]);
    expect(result.numItems).toBe(6);
    expect(result.numItems).toBe(result.contents.reduce((s, c) => s + c.quantity, 0));
  });

  it('skips invalid lines', () => {
    const result = buildMetaPurchaseContents([
      { productId: '', quantity: 1 },
      { productId: 'x', quantity: 0 },
      { productId: 'y', quantity: 2 },
    ]);
    expect(result.contents).toEqual([{ id: 'y', quantity: 2 }]);
    expect(result.numItems).toBe(2);
  });
});
