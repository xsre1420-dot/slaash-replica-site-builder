import { describe, it, expect } from 'vitest';
import { mapOrderError } from '@/utils/orderErrors';

describe('orderErrors', () => {
  it('maps stock errors to Arabic message', () => {
    expect(mapOrderError('insufficient stock')).toContain('متوفر');
  });

  it('maps coupon errors', () => {
    expect(mapOrderError('invalid coupon code')).toContain('خصم');
  });

  it('maps status transition errors', () => {
    expect(mapOrderError('invalid_status_transition')).toContain('حالة');
  });

  it('maps store resolution errors', () => {
    expect(mapOrderError('store_slug_required')).toContain('المتجر');
  });
});
