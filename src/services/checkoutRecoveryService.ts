import { rpcRecoverOrderByIdempotencyKey } from '@/repositories/orders/orderRepository';
import { normalizeStoreSlugForCheckout } from '@/lib/checkout/checkoutContract';
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
    const { data, error } = await rpcRecoverOrderByIdempotencyKey({
      p_idempotency_key: idempotencyKey,
      p_owner_id: ownerId,
      p_store_slug: normalizeStoreSlugForCheckout(storeSlug),
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
