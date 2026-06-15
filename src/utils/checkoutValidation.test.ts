import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

import { validateAndRefreshCart, buildCartFingerprint } from '@/utils/checkoutValidation';
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
});
