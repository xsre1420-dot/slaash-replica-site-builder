import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

import { validateAndRefreshCart, buildCartFingerprint, validateCheckoutItemStock } from '@/utils/checkoutValidation';
import { CartItem, Product } from '@/types';

const product = (id: string, price: number, stock = 10): Product => ({
  id,
  name: `Product ${id}`,
  description: '',
  category: 'c',
  price,
  image: '',
  stockQuantity: stock,
});

describe('checkoutValidation', () => {
  it('builds stable cart fingerprint', () => {
    const items: CartItem[] = [
      { product: product('a', 100), quantity: 2 },
      { product: product('b', 200), quantity: 1 },
    ];
    expect(buildCartFingerprint(items)).toBe(buildCartFingerprint([...items].reverse()));
  });

  it('removes unavailable products', () => {
    const items: CartItem[] = [{ product: product('gone', 100, 0), quantity: 1 }];
    const result = validateAndRefreshCart(items, new Map());
    expect(result.updatedItems).toHaveLength(0);
    expect(result.errors[0]).toContain('لم يعد متوفراً');
  });

  it('clamps quantity to available stock', () => {
    const fresh = product('p1', 500, 2);
    const items: CartItem[] = [{ product: fresh, quantity: 5 }];
    const result = validateAndRefreshCart(items, new Map([['p1', fresh]]));
    expect(result.updatedItems[0].quantity).toBe(2);
    expect(result.subtotal).toBe(1000);
  });

  it('trusts server stock of zero over stale cart snapshot', () => {
    const staleCart = product('p1', 500, 10);
    const freshServer = product('p1', 500, 0);
    const items: CartItem[] = [{ product: staleCart, quantity: 1 }];
    const result = validateAndRefreshCart(items, new Map([['p1', freshServer]]));
    expect(result.updatedItems).toHaveLength(0);
    expect(result.errors[0]).toContain('غير متوفر');
  });

  it('uses aggregate stock when variant rows are zero', () => {
    const fresh: Product = {
      ...product('p1', 500, 25),
      sizes: ['M', 'L'],
      variants: [
        { size: 'M', quantity: 0 },
        { size: 'L', quantity: 0 },
      ],
    };
    const items: CartItem[] = [{ product: fresh, quantity: 2, selectedSize: 'M' }];
    const result = validateAndRefreshCart(items, new Map([['p1', fresh]]));
    expect(result.updatedItems).toHaveLength(1);
    expect(result.updatedItems[0].quantity).toBe(2);
    expect(result.valid).toBe(true);
  });

  it('validateCheckoutItemStock allows aggregate when variant qty is zero', () => {
    const fresh: Product = {
      ...product('p1', 500, 20),
      sizes: ['M'],
      variants: [{ size: 'M', quantity: 0 }],
    };
    const item: CartItem = { product: fresh, quantity: 3, selectedSize: 'M' };
    expect(validateCheckoutItemStock(item, fresh).ok).toBe(true);
  });

  it('validateCheckoutItemStock rejects when no stock remains', () => {
    const fresh: Product = {
      ...product('p1', 500, 0),
      sizes: ['M'],
      variants: [{ size: 'M', quantity: 0 }],
    };
    const item: CartItem = { product: fresh, quantity: 1, selectedSize: 'M' };
    const result = validateCheckoutItemStock(item, fresh);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Product p1');
  });
});
