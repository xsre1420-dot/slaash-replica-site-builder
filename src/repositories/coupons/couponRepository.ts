import { supabase, callReadRpc, adaptRpcResult } from '@/repositories/base';

export async function rpcValidateStoreCouponBySlug(args: Record<string, unknown>) {
  return adaptRpcResult(await callReadRpc('validate_store_coupon_by_slug', args));
}

export async function rpcValidateStoreCoupon(args: Record<string, unknown>) {
  return adaptRpcResult(await callReadRpc('validate_store_coupon', args));
}

export function marketingCouponsTable() {
  return supabase.from('marketing_coupons');
}
