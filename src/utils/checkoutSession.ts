import { generateUUID } from '@/lib/uuid';

export const getOrCreateIdempotencyKey = (ownerId: string): string => {
  const storageKey = `checkout-idempotency:${ownerId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const key = generateUUID();
  sessionStorage.setItem(storageKey, key);
  return key;
};

export const clearCheckoutIdempotencyKey = (ownerId: string) => {
  sessionStorage.removeItem(`checkout-idempotency:${ownerId}`);
  sessionStorage.removeItem(`checkout-fingerprint:${ownerId}`);
};
