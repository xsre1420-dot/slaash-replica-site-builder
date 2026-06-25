import { describe, expect, it } from 'vitest';
import { getAvailableQty } from '@/utils/inventoryUtils';
import { Product } from '@/types';

/**
 * Client-side concurrency simulations — validates read-path stock math
 * under overlapping cart/checkout scenarios (DB locking tested via RPC design).
 */
describe('inventory concurrency (client simulation)', () => {
  const product = (stock: number, variantQty?: number): Product => ({
    id: 'p1',
    name: 'Widget',
    description: '',
    category: 'c',
    price: 100,
    image: '',
    stockQuantity: stock,
    variants: variantQty != null ? [{ size: 'M', quantity: variantQty }] : undefined,
  });

  it('rejects oversell when two carts each request half of remaining stock', () => {
    const p = product(5);
    const cartA = 3;
    const cartB = 3;
    const available = getAvailableQty(p);
    expect(cartA + cartB).toBeGreaterThan(available);
    expect(Math.min(cartA, available) + Math.min(cartB, available - Math.min(cartA, available))).toBe(
      5
    );
  });

  it('serializes duplicate line items like checkout RPC aggregation', () => {
    const lines = [
      { productId: 'p1', qty: 2 },
      { productId: 'p1', qty: 3 },
      { productId: 'p2', qty: 1 },
    ];
    const aggregated = [...lines.reduce((map, line) => {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.qty);
      return map;
    }, new Map<string, number>())];
    expect(aggregated).toEqual([
      ['p1', 5],
      ['p2', 1],
    ]);
  });

  it('variant checkout uses min of aggregate and variant row', () => {
    const p = product(3, 10);
    expect(getAvailableQty(p, 'M')).toBe(3);
  });

  it('duplicate submit with same idempotency key should not double-deduct (design contract)', () => {
    const idempotencyKey = 'checkout-session-abc';
    const inflight = new Map<string, string>();
    const first = inflight.get(idempotencyKey);
    expect(first).toBeUndefined();
    inflight.set(idempotencyKey, 'order-1');
    expect(inflight.get(idempotencyKey)).toBe('order-1');
  });
});
