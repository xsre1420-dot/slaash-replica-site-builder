import { memo } from 'react';
import ScrollReveal from '@/components/product-details/ScrollReveal';
import CartItemCard from '@/components/checkout/CartItemCard';
import CouponInput from '@/components/checkout/CouponInput';
import type { CartItem } from '@/types';
import type { AppliedCoupon } from '@/services/couponService';

interface CheckoutCartSectionProps {
  cartItems: CartItem[];
  cartCount: number;
  cartTotal: number;
  ownerId: string | null;
  storeSlug?: string;
  isTenantMode: boolean;
  appliedCoupon: AppliedCoupon | null;
  discountAmount: number;
  deliveryPrices: { governorate: string; price: number }[];
  selectedGovernorate: string;
  getMaxQuantity: (
    product: CartItem['product'],
    selectedSize?: string,
    selectedColor?: string
  ) => number;
  onRemove: (productId: string, selectedSize?: string, selectedColor?: string) => void;
  onUpdateQuantity: (
    productId: string,
    quantity: number,
    selectedSize?: string,
    selectedColor?: string
  ) => void;
  onApplyCoupon: (coupon: AppliedCoupon | null) => void;
}

const CheckoutCartSection = memo(function CheckoutCartSection({
  cartItems,
  cartCount,
  cartTotal,
  ownerId,
  storeSlug,
  isTenantMode,
  appliedCoupon,
  discountAmount,
  deliveryPrices,
  selectedGovernorate,
  getMaxQuantity,
  onRemove,
  onUpdateQuantity,
  onApplyCoupon,
}: CheckoutCartSectionProps) {
  return (
    <ScrollReveal delay={100}>
      <section className="pb-6 border-b border-gray-100">
        <h2 className="text-base font-bold mb-4 text-right text-gray-900">
          طلبك ({cartCount})
        </h2>
        <div className="space-y-3">
          {cartItems.map((item, index) => (
            <CartItemCard
              key={`${item.product.id}-${item.selectedSize || ''}-${item.selectedColor || ''}-${index}`}
              item={item}
              index={index}
              maxQuantity={getMaxQuantity(item.product, item.selectedSize, item.selectedColor)}
              onRemove={onRemove}
              onUpdateQuantity={onUpdateQuantity}
            />
          ))}
        </div>

        <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
          <span className="font-bold text-lg tabular-nums text-gray-900">{cartTotal.toLocaleString()} د.ع</span>
          <span className="text-sm font-medium text-gray-500">المجموع</span>
        </div>

        {ownerId && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2.5 text-right">كود الخصم</p>
            <CouponInput
              ownerId={ownerId}
              storeSlug={isTenantMode ? storeSlug : undefined}
              subtotal={cartTotal}
              appliedCoupon={appliedCoupon}
              onApply={onApplyCoupon}
            />
          </div>
        )}

        {discountAmount > 0 && (
          <div className="flex justify-between mt-3 text-sm text-primary font-medium">
            <span className="tabular-nums">-{discountAmount.toLocaleString()} د.ع</span>
            <span>الخصم ({appliedCoupon?.code})</span>
          </div>
        )}

        {deliveryPrices.length > 0 && !selectedGovernorate && (
          <p className="text-[11px] text-muted-foreground mt-3 text-right leading-relaxed">
            اختر المحافظة لعرض رسوم التوصيل والمجموع النهائي
          </p>
        )}
      </section>
    </ScrollReveal>
  );
});

export default CheckoutCartSection;
