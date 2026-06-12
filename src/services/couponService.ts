import { supabase } from '@/integrations/supabase/client';

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

export const validateCoupon = async (
  ownerId: string,
  code: string,
  subtotal: number,
  storeSlug?: string
): Promise<AppliedCoupon | null> => {
  let data: Record<string, unknown> | null = null;
  let rpcError: { message: string } | null = null;

  if (storeSlug) {
    const res = await (supabase as any).rpc('validate_store_coupon_by_slug', {
      p_slug: storeSlug.trim().toLowerCase(),
      p_code: code,
      p_subtotal: subtotal,
    });
    data = res.data;
    rpcError = res.error;
  } else {
    const res = await (supabase as any).rpc('validate_store_coupon', {
      p_owner_id: ownerId,
      p_code: code,
      p_subtotal: subtotal,
    });
    data = res.data;
    rpcError = res.error;
  }

  if (rpcError || !data?.valid) return null;

  return {
    code: String(data.code || code),
    discountAmount: Number(data.discount_amount) || 0,
  };
};
