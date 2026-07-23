/** Stable event IDs for Meta Pixel ↔ CAPI deduplication. */

export function createMetaEventId(prefix?: string): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return prefix ? `${prefix}:${id}` : id;
}

/** Purchase events use order id so browser + server dedupe reliably. */
export function purchaseEventId(orderId: string): string {
  return orderId.trim();
}
