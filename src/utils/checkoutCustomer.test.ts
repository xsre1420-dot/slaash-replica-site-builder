import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadCheckoutCustomer,
  saveCheckoutCustomer,
} from '@/utils/checkoutCustomer';

describe('checkoutCustomer', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('persists and restores customer info', () => {
    saveCheckoutCustomer('owner-1', {
      name: 'أحمد',
      phone: '07701234567',
      address: 'بغداد',
      notes: 'ملاحظة',
      governorate: 'بغداد',
    });

    const loaded = loadCheckoutCustomer('owner-1');
    expect(loaded?.name).toBe('أحمد');
    expect(loaded?.phone).toBe('07701234567');
    expect(loaded?.governorate).toBe('بغداد');
  });

  it('restores from localStorage backup when session is empty', () => {
    localStorage.setItem(
      'checkout-customer:owner-1:backup',
      JSON.stringify({
        name: 'سارة',
        phone: '07801234567',
        address: 'البصرة',
        notes: '',
        expiresAt: Date.now() + 60_000,
      })
    );

    const loaded = loadCheckoutCustomer('owner-1');
    expect(loaded?.name).toBe('سارة');
    expect(sessionStorage.getItem('checkout-customer:owner-1')).toBeTruthy();
  });

  it('does not overwrite with empty session before hydration in flow', () => {
    saveCheckoutCustomer('owner-1', {
      name: 'محمد',
      phone: '07701111111',
      address: 'أربيل',
      notes: '',
    });

    sessionStorage.removeItem('checkout-customer:owner-1');
    saveCheckoutCustomer('owner-1', { name: '', phone: '', address: '', notes: '' });

    const fromBackup = loadCheckoutCustomer('owner-1');
    expect(fromBackup?.name).toBe('');
  });
});
