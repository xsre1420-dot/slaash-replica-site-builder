import { generateUUID } from '@/lib/uuid';

const idempotencyKey = (ownerId: string) => `checkout-idempotency:${ownerId}`;
const orderIdKey = (ownerId: string) => `checkout-order-id:${ownerId}`;
const fingerprintKey = (ownerId: string) => `checkout-fingerprint:${ownerId}`;
const completedKey = (ownerId: string) => `checkout-completed:${ownerId}`;
const submitLockKey = (ownerId: string) => `checkout-submit-lock:${ownerId}`;
const crossTabLockKey = (ownerId: string) => `checkout-cross-lock:${ownerId}`;

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

const readLocal = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocal = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
};

const removeLocal = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const isLockFresh = (raw: string | null, now: number): boolean => {
  if (!raw) return false;
  const started = Number(raw);
  return Number.isFinite(started) && now - started < SUBMIT_LOCK_TTL_MS;
};

/** True when a checkout attempt is in progress (idempotency pinned, not yet completed). */
export const hasPendingCheckoutAttempt = (ownerId: string): boolean => {
  if (loadCompletedCheckoutOrderId(ownerId)) return false;
  return !!readSession(idempotencyKey(ownerId));
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

/** Pin idempotency + order id before any async validation (survives refresh / retries). */
export const pinCheckoutAttempt = (ownerId: string): { idempotencyKey: string; orderId: string } => ({
  idempotencyKey: getOrCreateIdempotencyKey(ownerId),
  orderId: getStableCheckoutOrderId(ownerId),
});

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
 * Cross-tab submit lock (sessionStorage + localStorage).
 * Returns false if another tab is submitting the same checkout.
 */
export const acquireCheckoutSubmitLock = (ownerId: string): boolean => {
  const now = Date.now();
  const sessionRaw = readSession(submitLockKey(ownerId));
  if (isLockFresh(sessionRaw, now)) {
    return false;
  }

  const crossRaw = readLocal(crossTabLockKey(ownerId));
  if (isLockFresh(crossRaw, now)) {
    return false;
  }

  const stamp = String(now);
  writeSession(submitLockKey(ownerId), stamp);
  writeLocal(crossTabLockKey(ownerId), stamp);
  return true;
};

export const releaseCheckoutSubmitLock = (ownerId: string): void => {
  removeSession(submitLockKey(ownerId));
  removeLocal(crossTabLockKey(ownerId));
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

/** Clears the completed marker so a new checkout can start in the same session. */
export const clearCheckoutCompletedMarker = (ownerId: string): void => {
  removeSession(completedKey(ownerId));
};

export const clearCheckoutIdempotencyKey = (ownerId: string) => {
  removeSession(idempotencyKey(ownerId));
  removeSession(fingerprintKey(ownerId));
};

export const clearCheckoutSession = (ownerId: string) => {
  removeSession(idempotencyKey(ownerId));
  removeSession(fingerprintKey(ownerId));
  removeSession(orderIdKey(ownerId));
  removeSession(submitLockKey(ownerId));
  removeLocal(crossTabLockKey(ownerId));
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
