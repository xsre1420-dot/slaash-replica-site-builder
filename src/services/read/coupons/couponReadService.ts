import { supabase } from '@/integrations/supabase/client';

const COUPON_LIST_SELECT =
  'id, code, discount_type, discount_value, minimum_order_amount, usage_limit, used_count, start_date, end_date, is_active, description';

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

export interface MerchantCoupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_order_amount: number;
  usage_limit: number | null;
  used_count: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  description: string;
}

export async function listMerchantCoupons(ownerId: string): Promise<MerchantCoupon[]> {
  const { data, error } = await supabase
    .from('marketing_coupons')
    .select(COUPON_LIST_SELECT)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as MerchantCoupon[];
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
