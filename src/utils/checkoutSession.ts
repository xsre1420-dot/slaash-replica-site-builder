import { generateUUID } from '@/lib/uuid';

const idempotencyKey = (ownerId: string) => `checkout-idempotency:${ownerId}`;
const orderIdKey = (ownerId: string) => `checkout-order-id:${ownerId}`;
const fingerprintKey = (ownerId: string) => `checkout-fingerprint:${ownerId}`;
const completedKey = (ownerId: string) => `checkout-completed:${ownerId}`;
const submitLockKey = (ownerId: string) => `checkout-submit-lock:${ownerId}`;

const SUBMIT_LOCK_TTL_MS = 3 * 60 * 1000;

const readSession = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeSession = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
};

const removeSession = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

/** Stable idempotency key per checkout attempt — shared across tabs via sessionStorage. */
export const getOrCreateIdempotencyKey = (ownerId: string): string => {
  const storageKey = idempotencyKey(ownerId);
  const existing = readSession(storageKey);
  if (existing) return existing;
  const key = generateUUID();
  writeSession(storageKey, key);
  return key;
};

/** Stable client order UUID — reused on retries so p_order_id stays consistent. */
export const getStableCheckoutOrderId = (ownerId: string): string => {
  const storageKey = orderIdKey(ownerId);
  const existing = readSession(storageKey);
  if (existing) return existing;
  const id = generateUUID();
  writeSession(storageKey, id);
  return id;
};

/**
 * Cross-tab submit lock (sessionStorage). Returns false if another tab is submitting.
 */
export const acquireCheckoutSubmitLock = (ownerId: string): boolean => {
  const key = submitLockKey(ownerId);
  const raw = readSession(key);
  const now = Date.now();
  if (raw) {
    const started = Number(raw);
    if (Number.isFinite(started) && now - started < SUBMIT_LOCK_TTL_MS) {
      return false;
    }
  }
  writeSession(key, String(now));
  return true;
};

export const releaseCheckoutSubmitLock = (ownerId: string): void => {
  removeSession(submitLockKey(ownerId));
};

export const touchCheckoutSubmitLock = (ownerId: string): void => {
  writeSession(submitLockKey(ownerId), String(Date.now()));
};

export const markCheckoutCompleted = (ownerId: string, orderId: string): void => {
  writeSession(completedKey(ownerId), orderId);
  clearCheckoutSession(ownerId);
};

export const loadCompletedCheckoutOrderId = (ownerId: string): string | null =>
  readSession(completedKey(ownerId));

export const clearCheckoutIdempotencyKey = (ownerId: string) => {
  removeSession(idempotencyKey(ownerId));
  removeSession(fingerprintKey(ownerId));
};

export const clearCheckoutSession = (ownerId: string) => {
  removeSession(idempotencyKey(ownerId));
  removeSession(fingerprintKey(ownerId));
  removeSession(orderIdKey(ownerId));
  removeSession(submitLockKey(ownerId));
};

export const persistCheckoutFingerprint = (ownerId: string, fingerprint: string): void => {
  const prev = readSession(fingerprintKey(ownerId));
  if (prev && prev !== fingerprint) {
    clearCheckoutIdempotencyKey(ownerId);
    removeSession(orderIdKey(ownerId));
  }
  writeSession(fingerprintKey(ownerId), fingerprint);
};

export type CheckoutSubmitPhase = 'idle' | 'validating' | 'creating' | 'success' | 'error';
