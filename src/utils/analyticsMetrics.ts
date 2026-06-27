/** Net revenue = completed revenue minus refunds (matches statistics page). */
export const netRevenueFromRpc = (
  record: Record<string, unknown> | null | undefined
): number => {
  if (!record || typeof record !== 'object') return 0;
  const gross = Number(record.completed_revenue ?? 0);
  const refunds = Number(record.refund_total ?? 0);
  if (!Number.isFinite(gross)) return 0;
  if (!Number.isFinite(refunds)) return Math.max(0, gross);
  return Math.max(0, gross - refunds);
};
