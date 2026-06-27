import { describe, it, expect } from 'vitest';
import {
  getOrderWorkflowCategory,
  filterOrdersList,
  countOrdersByWorkflowTab,
  normalizeOrderPhone,
  DEFAULT_ORDER_FILTERS,
} from '@/utils/orderWorkflowUtils';
import { Order } from '@/types';

const baseOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'abc-123-def-456',
  items: [{ product: { id: 'p1', name: 'Test', price: 1000, image: '', description: '', category: '' }, quantity: 1 }],
  customerInfo: { name: 'أحمد', phone: '07xx xxx xxxx', address: 'بغداد' },
  total: 1000,
  date: new Date().toISOString(),
  status: 'pending',
  paymentStatus: 'pending_collection',
  deliveryStatus: 'pending',
  ...overrides,
});

describe('orderWorkflowUtils', () => {
  it('classifies new pending COD orders', () => {
    expect(getOrderWorkflowCategory(baseOrder())).toBe('new');
  });

  it('classifies preparing orders as processing', () => {
    expect(getOrderWorkflowCategory(baseOrder({ deliveryStatus: 'preparing' }))).toBe('processing');
  });

  it('classifies cancelled before other states', () => {
    expect(
      getOrderWorkflowCategory(baseOrder({ status: 'cancelled', deliveryStatus: 'shipped' }))
    ).toBe('cancelled');
  });

  it('filters by normalized phone digits', () => {
    const orders = [
      baseOrder({ id: '1', customerInfo: { name: 'A', phone: '07701234567', address: 'x' } }),
      baseOrder({ id: '2', customerInfo: { name: 'B', phone: '07801111111', address: 'y' } }),
    ];
    const filtered = filterOrdersList(orders, {
      ...DEFAULT_ORDER_FILTERS,
      search: '0770 123',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('matches payment status filter with defaults', () => {
    const orders = [baseOrder({ paymentStatus: undefined })];
    const filtered = filterOrdersList(orders, {
      ...DEFAULT_ORDER_FILTERS,
      paymentStatus: 'pending_collection',
    });
    expect(filtered).toHaveLength(1);
  });

  it('counts workflow tabs exclusively', () => {
    const orders = [
      baseOrder({ id: '1' }),
      baseOrder({ id: '2', deliveryStatus: 'preparing' }),
      baseOrder({ id: '3', status: 'cancelled' }),
    ];
    const counts = countOrdersByWorkflowTab(orders);
    expect(counts.new).toBe(1);
    expect(counts.processing).toBe(1);
    expect(counts.cancelled).toBe(1);
    expect(counts.all).toBe(3);
  });

  it('strips non-digits from phone search', () => {
    expect(normalizeOrderPhone('07xx 123-4567')).toBe('071234567');
  });
});
