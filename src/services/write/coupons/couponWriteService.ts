/**
 * Coupon mutations — no list/validation reads.
 */
import { supabase } from '@/integrations/supabase/client';
import type { MerchantCoupon } from '@/services/read/coupons/couponReadService';

export async function createMerchantCoupon(
  ownerId: string,
  coupon: Omit<MerchantCoupon, 'id' | 'used_count' | 'is_active'> & { is_active?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('marketing_coupons').insert({
    owner_id: ownerId,
    ...coupon,
    is_active: coupon.is_active ?? true,
    used_count: 0,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateMerchantCoupon(
  ownerId: string,
  couponId: string,
  updates: Partial<MerchantCoupon>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('marketing_coupons')
    .update(updates)
    .eq('id', couponId)
    .eq('owner_id', ownerId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteMerchantCoupon(
  ownerId: string,
  couponId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('marketing_coupons')
    .delete()
    .eq('id', couponId)
    .eq('owner_id', ownerId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
