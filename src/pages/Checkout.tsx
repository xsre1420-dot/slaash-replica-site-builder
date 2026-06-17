import { Link } from "react-router-dom";
import { useRef, useEffect } from "react";
import { ShoppingBag, Loader2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/product-details/ScrollReveal";
import CheckoutHeader from "@/components/checkout/CheckoutHeader";
import ProgressSteps from "@/components/checkout/ProgressSteps";
import CartItemCard from "@/components/checkout/CartItemCard";
import DeliveryForm from "@/components/checkout/DeliveryForm";
import GuaranteesBar from "@/components/checkout/GuaranteesBar";
import OrderSuccessModal from "@/components/checkout/OrderSuccessModal";
import CouponInput from "@/components/checkout/CouponInput";
import PaymentMethodSelector from "@/components/checkout/PaymentMethodSelector";
import { useCheckoutFlow } from "@/hooks/useCheckoutFlow";
import MarketingScripts from "@/components/MarketingScripts";
import { useStoreVisitTracking } from "@/hooks/useStoreVisitTracking";
import StoreThemeProvider from "@/components/StoreThemeProvider";
import StorefrontTrustBar from "@/components/storefront/StorefrontTrustBar";
import { useStoreDisplay } from "@/hooks/useStoreDisplay";
import { useTenantStore } from "@/hooks/useTenantStore";

const Checkout = () => {
  const { removeFromCart, updateQuantity, getMaxQuantity } = useCart();
  const formRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef(0);

  const {
    isTenantMode,
    storeSlug,
    tenantLoading,
    cartItems,
    cartCount,
    ownerId,
    storeHomePath,
    orderCompleted,
    completedOrderId,
    isSubmitting,
    formErrors,
    customerInfo,
    selectedGovernorate,
    appliedCoupon,
    setAppliedCoupon,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    deliveryFee,
    deliveryPrices,
    paymentMethodOptions,
    discountAmount,
    totalWithDelivery,
    currentStep,
    cartTotal,
    handleInputChange,
    handleGovernorateChange,
    handleSubmitOrder,
  } = useCheckoutFlow();

  const tenant = useTenantStore(storeSlug);
  const display = useStoreDisplay(storeSlug);
  const themeColors = {
    backgroundColor: display.storeSettings.menuBackgroundColor,
    textColor: display.storeSettings.menuTextColor,
    accentColor: display.storeSettings.menuAccentColor,
    font: display.storeSettings.storeFont,
  };

  useStoreVisitTracking(isTenantMode ? storeSlug : undefined);

  useEffect(() => {
    if (currentStep > prevStepRef.current && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prevStepRef.current = currentStep;
  }, [currentStep]);

  if (isTenantMode && tenantLoading && !ownerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <StoreThemeProvider colors={themeColors} className="min-h-dvh flex flex-col">
    <div className="flex flex-col flex-1 min-h-dvh w-full bg-background font-arabic" dir="rtl">
      <MarketingScripts
        storeSlug={isTenantMode ? storeSlug : undefined}
        storeOwnerId={ownerId}
        disabled={!isTenantMode}
      />
      <CheckoutHeader cartCount={cartCount} backTo={storeHomePath} />
      <StorefrontTrustBar compact fullWidth />

      {cartItems.length > 0 && (
        <ProgressSteps currentStep={currentStep} fullWidth />
      )}

      <div className="flex-1 w-full px-4 sm:px-5 pt-2 pb-36 space-y-3 md:pb-10">
        {cartItems.length === 0 ? (
          <ScrollReveal>
            <div className="text-center py-16 mt-8">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <ShoppingBag className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">سلة التسوق فارغة</h3>
              <p className="text-muted-foreground text-sm mb-6">اكتشف منتجاتنا المميزة وأضف ما يعجبك!</p>
              <Link to={storeHomePath}>
                <Button className="rounded-xl px-8">تصفح المنتجات</Button>
              </Link>
            </div>
          </ScrollReveal>
        ) : (
          <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-3">

            <ScrollReveal delay={100}>
              <section className="bg-card rounded-xl border border-border/50 p-3.5 sm:p-4">
                <h2 className="text-base font-semibold mb-2.5 text-right text-foreground">
                  طلبك ({cartCount})
                </h2>
                <div className="space-y-2">
                  {cartItems.map((item, index) => (
                    <CartItemCard
                      key={`${item.product.id}-${item.selectedSize || ""}-${item.selectedColor || ""}-${index}`}
                      item={item}
                      index={index}
                      maxQuantity={getMaxQuantity(item.product, item.selectedSize, item.selectedColor)}
                      onRemove={removeFromCart}
                      onUpdateQuantity={updateQuantity}
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
                      onApply={setAppliedCoupon}
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

            <ScrollReveal delay={150}>
              <section className="bg-card rounded-xl border border-border/50 p-3.5 sm:p-4">
                <h2 className="text-base font-semibold mb-2.5 text-right text-foreground">طريقة الدفع</h2>
                <PaymentMethodSelector
                  methods={paymentMethodOptions}
                  selected={selectedPaymentMethod}
                  onSelect={setSelectedPaymentMethod}
                />
              </section>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <section className="bg-card rounded-xl border border-border/50 p-3.5 sm:p-4" ref={formRef}>
                <h2 className="text-base font-semibold mb-2.5 text-right text-foreground">معلومات التوصيل</h2>
                <DeliveryForm
                  customerInfo={customerInfo}
                  onInputChange={handleInputChange}
                  selectedGovernorate={selectedGovernorate}
                  onGovernorateChange={handleGovernorateChange}
                  deliveryPrices={deliveryPrices}
                  deliveryFee={deliveryFee}
                  formErrors={formErrors}
                />
              </section>
            </ScrollReveal>

            {selectedGovernorate && (
              <ScrollReveal delay={300}>
                <section
                  dir="rtl"
                  className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3.5 sm:p-4 space-y-2.5"
                >
                  <h3 className="text-base font-semibold text-right text-foreground">ملخص الدفع</h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-muted-foreground">مجموع المنتجات</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {cartTotal.toLocaleString()} د.ع
                      </span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-primary">الخصم ({appliedCoupon?.code})</span>
                        <span className="text-sm font-semibold tabular-nums text-primary">
                          -{discountAmount.toLocaleString()} د.ع
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-muted-foreground">رسوم التوصيل</span>
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          deliveryFee > 0 ? "text-foreground" : "text-emerald-600"
                        }`}
                      >
                        {deliveryFee > 0 ? `${deliveryFee.toLocaleString()} د.ع` : "مجاني"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2.5 border-t border-primary/20">
                    <span className="text-sm font-bold text-foreground">المجموع النهائي</span>
                    <span className="text-lg font-bold tabular-nums text-primary">
                      {totalWithDelivery.toLocaleString()} د.ع
                    </span>
                  </div>
                </section>
              </ScrollReveal>
            )}

            <GuaranteesBar compact />

            <ScrollReveal delay={400}>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl py-2.5 text-sm font-bold h-12 bg-primary hover:bg-primary/90 transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأكيد الطلب"}
              </Button>
            </ScrollReveal>
          </form>
        )}
        <div className="h-5 shrink-0 bg-background md:h-8" aria-hidden />
      </div>

      {cartItems.length > 0 && !orderCompleted && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/50 px-3 py-2.5 z-30 md:hidden safe-area-bottom"
          dir="rtl"
        >
          <div className="w-full flex items-center gap-2">
            <div className="text-right flex-1 min-w-0">
              <span className="text-[11px] text-muted-foreground">{cartCount} منتج</span>
              <p className="text-sm font-bold text-foreground leading-tight">
                {deliveryPrices.length > 0 && !selectedGovernorate
                  ? `${cartTotal.toLocaleString()} د.ع`
                  : `${totalWithDelivery.toLocaleString()} د.ع`}
              </p>
              {deliveryPrices.length > 0 && !selectedGovernorate && (
                <span className="text-[10px] text-muted-foreground">+ التوصيل بعد اختيار المحافظة</span>
              )}
            </div>
            <Button
              type="button"
              onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}
              variant="outline"
              className="h-10 min-h-0 min-w-0 rounded-xl px-3 text-xs font-semibold shrink-0 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary hover:border-primary/40"
            >
              التوصيل
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => document.getElementById('checkout-form')?.requestSubmit()}
              className="h-10 min-h-0 min-w-0 rounded-xl px-3 text-xs font-semibold shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'تأكيد'}
            </Button>
          </div>
        </div>
      )}

      {orderCompleted && (
        <OrderSuccessModal
          orderId={completedOrderId}
          storeSlug={storeSlug}
          whatsappNumber={display.storeSettings.whatsappNumber || tenant.storeInfo?.whatsappNumber}
        />
      )}
    </div>
    </StoreThemeProvider>
  );
};

export default Checkout;
