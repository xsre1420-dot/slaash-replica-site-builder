/**
 * Legacy coupon service facade.
 */
export {
  listMerchantCoupons,
  validateCoupon,
  type AppliedCoupon,
  type MerchantCoupon,
} from '@/services/read/coupons/couponReadService';

export {
  createMerchantCoupon,
  updateMerchantCoupon,
  deleteMerchantCoupon,
} from '@/services/write/coupons/couponWriteService';
