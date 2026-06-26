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
      <section className="bg-card rounded-xl border border-border/50 p-3.5 sm:p-4">
        <h2 className="text-base font-semibold mb-2.5 text-right text-foreground">
          طلبك ({cartCount})
        </h2>
        <div className="space-y-2">
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
        <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-border/50">
          <span className="font-semibold text-base text-foreground">{cartTotal.toLocaleString()} د.ع</span>
          <span className="text-sm font-medium text-muted-foreground">المجموع</span>
        </div>

        {ownerId && (
          <div className="mt-3 pt-2.5 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2 text-right">كود الخصم</p>
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
          <div className="flex justify-between mt-2 text-xs text-primary">
            <span>-{discountAmount.toLocaleString()} د.ع</span>
            <span>الخصم ({appliedCoupon?.code})</span>
          </div>
        )}

        {deliveryPrices.length > 0 && !selectedGovernorate && (
          <p className="text-[11px] text-muted-foreground mt-2.5 text-right leading-relaxed">
            اختر المحافظة لعرض رسوم التوصيل والمجموع النهائي
          </p>
        )}
      </section>
    </ScrollReveal>
  );
});

export default CheckoutCartSection;
