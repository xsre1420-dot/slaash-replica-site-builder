import { describe, it, expect } from 'vitest';
import { mapDbOrder } from '@/mappers/orderMapper';

describe('orderMapper', () => {
  it('maps order row with items', () => {
    const order = mapDbOrder({
      id: 'ord-1',
      customer_name: 'Ali',
      customer_phone: '07701234567',
      customer_address: 'Baghdad',
      customer_governorate: 'بغداد',
      total_amount: 25000,
      created_at: '2026-01-01T10:00:00Z',
      status: 'pending',
      delivery_fee: 3000,
      delivery_status: 'pending',
      order_items: [
        {
          product_id: 'p1',
          product_name: 'Shirt',
          product_price: 10000,
          quantity: 2,
          variant_metadata: { selected_size: 'M' },
        },
      ],
    });

    expect(order.id).toBe('ord-1');
    expect(order.customerInfo.name).toBe('Ali');
    expect(order.total).toBe(25000);
    expect(order.deliveryFee).toBe(3000);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[0].selectedSize).toBe('M');
  });
});
