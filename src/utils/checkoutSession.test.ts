import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getOrCreateIdempotencyKey,
  getStableCheckoutOrderId,
  acquireCheckoutSubmitLock,
  releaseCheckoutSubmitLock,
  persistCheckoutFingerprint,
  markCheckoutCompleted,
  loadCompletedCheckoutOrderId,
  clearCheckoutSession,
  hasPendingCheckoutAttempt,
  pinCheckoutAttempt,
} from './checkoutSession';

describe('checkoutSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reuses idempotency key within session', () => {
    const a = getOrCreateIdempotencyKey('owner-1');
    const b = getOrCreateIdempotencyKey('owner-1');
    expect(a).toBe(b);
  });

  it('reuses stable order id within session', () => {
    const a = getStableCheckoutOrderId('owner-1');
    const b = getStableCheckoutOrderId('owner-1');
    expect(a).toBe(b);
  });

  it('resets idempotency when cart fingerprint changes', () => {
    const key1 = getOrCreateIdempotencyKey('owner-1');
    persistCheckoutFingerprint('owner-1', 'cart-a');
    persistCheckoutFingerprint('owner-1', 'cart-b');
    const key2 = getOrCreateIdempotencyKey('owner-1');
    expect(key2).not.toBe(key1);
  });

  it('blocks parallel submit lock in same session', () => {
    expect(acquireCheckoutSubmitLock('owner-1')).toBe(true);
    expect(acquireCheckoutSubmitLock('owner-1')).toBe(false);
    releaseCheckoutSubmitLock('owner-1');
    expect(acquireCheckoutSubmitLock('owner-1')).toBe(true);
  });

  it('blocks cross-tab submit lock via localStorage', () => {
    localStorage.setItem('checkout-cross-lock:owner-1', String(Date.now()));
    expect(acquireCheckoutSubmitLock('owner-1')).toBe(false);
    localStorage.removeItem('checkout-cross-lock:owner-1');
  });

  it('tracks pending checkout attempts', () => {
    expect(hasPendingCheckoutAttempt('owner-1')).toBe(false);
    pinCheckoutAttempt('owner-1');
    expect(hasPendingCheckoutAttempt('owner-1')).toBe(true);
    markCheckoutCompleted('owner-1', 'order-1');
    expect(hasPendingCheckoutAttempt('owner-1')).toBe(false);
  });

  it('pins stable ids before submit', () => {
    const first = pinCheckoutAttempt('owner-1');
    const second = pinCheckoutAttempt('owner-1');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.orderId).toBe(first.orderId);
  });

  it('marks completed order and clears pending session keys', () => {
    getOrCreateIdempotencyKey('owner-1');
    getStableCheckoutOrderId('owner-1');
    markCheckoutCompleted('owner-1', 'order-99');
    expect(loadCompletedCheckoutOrderId('owner-1')).toBe('order-99');
    const newKey = getOrCreateIdempotencyKey('owner-1');
    expect(newKey).toBeTruthy();
    clearCheckoutSession('owner-1');
    expect(loadCompletedCheckoutOrderId('owner-1')).toBe('order-99');
  });
});
