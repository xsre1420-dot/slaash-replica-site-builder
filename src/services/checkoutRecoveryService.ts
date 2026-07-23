import { callReadRpc } from '@/lib/readWrite/readClient';
import { getOrCreateIdempotencyKey } from '@/utils/checkoutSession';

export type RecoveredCheckoutOrder = {
  orderId: string;
  totalAmount: number;
  idempotent: boolean;
};

/**
 * After a network failure, check if the server already created the order
 * (same idempotency key in sessionStorage).
 */
export const tryRecoverCheckoutOrder = async (
  ownerId: string,
  storeSlug?: string | null
): Promise<RecoveredCheckoutOrder | null> => {
  const idempotencyKey = getOrCreateIdempotencyKey(ownerId);
  if (!idempotencyKey) return null;

  try {
    const { data, error } = await callReadRpc<Record<string, unknown>>('get_order_by_idempotency_key', {
      p_idempotency_key: idempotencyKey,
      p_owner_id: ownerId,
      p_store_slug: storeSlug?.trim().toLowerCase() || null,
    });

    if (error || !data?.found) return null;

    return {
      orderId: String(data.order_id),
      totalAmount: Number(data.total_amount) || 0,
      idempotent: true,
    };
  } catch {
    return null;
  }
};
