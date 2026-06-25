/** Suppresses realtime echo invalidations/refetches shortly after a local mutation. */
const STOREFRONT_SUPPRESS_MS = 3_000;
const ORDER_ECHO_SUPPRESS_MS = 5_000;

const storefrontSuppressUntil = new Map<string, number>();
const orderEchoSuppressUntil = new Map<string, number>();

export const markLocalStorefrontMutation = (ownerId: string): void => {
  storefrontSuppressUntil.set(ownerId, Date.now() + STOREFRONT_SUPPRESS_MS);
};

export const shouldSuppressRealtimeStorefrontInvalidation = (ownerId: string): boolean => {
  const until = storefrontSuppressUntil.get(ownerId) ?? 0;
  if (Date.now() < until) return true;
  if (until > 0) storefrontSuppressUntil.delete(ownerId);
  return false;
};

export const markLocalOrderMutation = (orderId: string): void => {
  orderEchoSuppressUntil.set(orderId, Date.now() + ORDER_ECHO_SUPPRESS_MS);
};

export const isLocalOrderMutationEcho = (orderId: string): boolean => {
  const until = orderEchoSuppressUntil.get(orderId) ?? 0;
  if (Date.now() < until) return true;
  if (until > 0) orderEchoSuppressUntil.delete(orderId);
  return false;
};

export const resetLocalMutationGuardsForTests = (): void => {
  storefrontSuppressUntil.clear();
  orderEchoSuppressUntil.clear();
};
