/**

 * Coupon mutations — no list/validation reads.

 */

import { callWriteRpc } from '@/lib/readWrite/writeClient';

import { marketingCouponsTable } from '@/repositories/coupons/couponRepository';

import { ensureWritableSession } from '@/lib/authSession';

import { mapMarketingWriteError } from '@/lib/marketingWriteErrors';

import type { MerchantCoupon } from '@/services/read/coupons/couponReadService';



export async function createMerchantCoupon(

  ownerId: string,

  coupon: Omit<MerchantCoupon, 'id' | 'used_count' | 'is_active'> & { is_active?: boolean }

): Promise<{ success: boolean; error?: string }> {

  const sessionOwnerId = await ensureWritableSession();

  if (!sessionOwnerId || sessionOwnerId !== ownerId) {

    return { success: false, error: 'session_expired' };

  }



  const { data, error } = await callWriteRpc<Record<string, unknown>>('create_merchant_coupon', {

    p_owner_id: ownerId,

    p_coupon: {

      code: coupon.code,

      discount_type: coupon.discount_type,

      discount_value: coupon.discount_value,

      minimum_order_amount: coupon.minimum_order_amount ?? 0,

      usage_limit: coupon.usage_limit,

      start_date: coupon.start_date,

      end_date: coupon.end_date,

      description: coupon.description?.trim() || null,

      is_active: coupon.is_active ?? true,

    },

  });



  if (!error && data?.success === true) {

    return { success: true };

  }



  if (data?.success === false) {

    return { success: false, error: mapMarketingWriteError(String(data.error ?? 'coupon_create_failed')) };

  }



  if (error) {

    return { success: false, error: mapMarketingWriteError(error) };

  }



  // Fallback if RPC not deployed yet

  const { error: insertError } = await marketingCouponsTable().insert({

    owner_id: ownerId,

    ...coupon,

    description: coupon.description?.trim() || null,

    is_active: coupon.is_active ?? true,

    used_count: 0,

  });

  if (insertError) return { success: false, error: mapMarketingWriteError(insertError.message) };

  return { success: true };

}



export async function updateMerchantCoupon(

  ownerId: string,

  couponId: string,

  updates: Partial<MerchantCoupon>

): Promise<{ success: boolean; error?: string }> {

  const { error } = await marketingCouponsTable()

    .update(updates)

    .eq('id', couponId)

    .eq('owner_id', ownerId);

  if (error) return { success: false, error: mapMarketingWriteError(error.message) };

  return { success: true };

}



export async function deleteMerchantCoupon(

  ownerId: string,

  couponId: string

): Promise<{ success: boolean; error?: string }> {

  const { error } = await marketingCouponsTable()

    .delete()

    .eq('id', couponId)

    .eq('owner_id', ownerId);

  if (error) return { success: false, error: mapMarketingWriteError(error.message) };

  return { success: true };

}


