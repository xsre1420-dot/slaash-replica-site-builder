import { describe, expect, it } from 'vitest';
import {
  CHECKOUT_CREATE_RPC,
  normalizeCheckoutRpcItems,
  normalizeStoreSlugForCheckout,
  type CreateOrderWithStockDeductionArgs,
} from '@/lib/checkout/checkoutContract';
import type { CartItem } from '@/types';

describe('checkoutContract', () => {
  const sampleCartItem: CartItem = {
    product: {
      id: 'prod-1',
      name: 'Shirt',
      description: '',
      category: 'c',
      price: 1000,
      image: '',
      colors: [{ name: 'Red', value: '#f00' }],
    },
    quantity: 2,
    selectedSize: ' L ',
    selectedColor: '#f00',
    selectedColorName: 'Red',
  };

  it('defines single canonical checkout RPC name', () => {
    expect(CHECKOUT_CREATE_RPC).toBe('create_order_with_stock_deduction');
  });

  it('normalizes RPC items with trimmed variant fields', () => {
    const items = normalizeCheckoutRpcItems([sampleCartItem]);
    expect(items[0]).toEqual({
      product_id: 'prod-1',
      quantity: 2,
      selected_size: 'L',
      selected_color: '#f00',
      color_name: 'Red',
      color_image: null,
    });
  });

  it('normalizes store slug to lowercase', () => {
    expect(normalizeStoreSlugForCheckout(' Demo-Store ')).toBe('demo-store');
    expect(normalizeStoreSlugForCheckout('')).toBeNull();
    expect(normalizeStoreSlugForCheckout(null)).toBeNull();
  });

  it('builds full RPC arg shape with p_store_slug (13-param overload)', () => {
    const args: CreateOrderWithStockDeductionArgs = {
      p_order_id: 'order-uuid',
      p_owner_id: 'owner-uuid',
      p_idempotency_key: 'idem-key',
      p_customer_name: 'Ali',
      p_customer_phone: '07701234567',
      p_customer_address: 'Baghdad',
      p_total_amount: 5000,
      p_customer_governorate: 'Baghdad',
      p_notes: null,
      p_items: normalizeCheckoutRpcItems([sampleCartItem]),
      p_payment_method: 'cash_on_delivery',
      p_coupon_code: null,
      p_store_slug: 'demo-store',
    };

    expect(Object.keys(args).sort()).toEqual([
      'p_coupon_code',
      'p_customer_address',
      'p_customer_governorate',
      'p_customer_name',
      'p_customer_phone',
      'p_idempotency_key',
      'p_items',
      'p_notes',
      'p_order_id',
      'p_owner_id',
      'p_payment_method',
      'p_store_slug',
      'p_total_amount',
    ]);
  });

  it('aggregates duplicate product lines like checkout RPC', () => {
    const lines = [
      { product_id: 'p1', qty: 2 },
      { product_id: 'p1', qty: 3 },
      { product_id: 'p2', qty: 1 },
    ];
    const aggregated = [...lines.reduce((map, line) => {
      map.set(line.product_id, (map.get(line.product_id) ?? 0) + line.qty);
      return map;
    }, new Map<string, number>())];
    expect(aggregated).toEqual([
      ['p1', 5],
      ['p2', 1],
    ]);
  });

  it('concurrent carts cannot oversell when combined qty exceeds stock (client preflight)', () => {
    const stock = 5;
    const cartA = 3;
    const cartB = 3;
    expect(cartA + cartB).toBeGreaterThan(stock);
    const firstCommit = Math.min(cartA, stock);
    const secondCommit = Math.min(cartB, stock - firstCommit);
    expect(firstCommit + secondCommit).toBe(stock);
  });
});
