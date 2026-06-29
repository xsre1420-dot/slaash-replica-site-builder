import { supabase } from '@/repositories/base';

export function marketingCouponsTable() {
  return supabase.from('marketing_coupons');
}

export async function rpcValidateStoreCouponBySlug(args: Record<string, unknown>) {
  return (supabase as any).rpc('validate_store_coupon_by_slug', args);
}

export async function rpcValidateStoreCoupon(args: Record<string, unknown>) {
  return (supabase as any).rpc('validate_store_coupon', args);
}
