export const getOrCreateIdempotencyKey = (ownerId: string): string => {
  const storageKey = `checkout-idempotency:${ownerId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const key =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(storageKey, key);
  return key;
};

export const clearCheckoutIdempotencyKey = (ownerId: string) => {
  sessionStorage.removeItem(`checkout-idempotency:${ownerId}`);
  sessionStorage.removeItem(`checkout-fingerprint:${ownerId}`);
};
