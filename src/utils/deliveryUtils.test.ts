import { describe, it, expect } from 'vitest';
import {
  calculateDeliveryFeeFromPrices,
  computeOrderTotal,
  getDeliveryStatusLabel,
  hasConfiguredDeliveryPrices,
} from '@/utils/deliveryUtils';

describe('deliveryUtils', () => {
  it('calculates delivery fee by governorate', () => {
    const fee = calculateDeliveryFeeFromPrices(
      [{ governorate: 'بغداد', price: 5000 }],
      'بغداد'
    );
    expect(fee).toBe(5000);
  });

  it('returns 0 for unknown governorate', () => {
    expect(calculateDeliveryFeeFromPrices([{ governorate: 'بغداد', price: 5000 }], 'البصرة')).toBe(0);
  });

  it('computes order total with discount and delivery', () => {
    expect(computeOrderTotal(10000, 3000, 2000)).toBe(11000);
  });

  it('never returns negative total', () => {
    expect(computeOrderTotal(1000, 500, 5000)).toBe(500);
  });

  it('labels delivery status in Arabic', () => {
    expect(getDeliveryStatusLabel('delivered')).toBe('تم التسليم');
  });

  it('detects configured delivery prices', () => {
    expect(hasConfiguredDeliveryPrices([])).toBe(false);
    expect(hasConfiguredDeliveryPrices(undefined)).toBe(false);
    expect(hasConfiguredDeliveryPrices([{ governorate: 'بغداد', price: 0 }])).toBe(true);
  });
});
