import { Link } from "react-router-dom";
import { useRef } from "react";
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
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import StorefrontTrustBar from "@/components/storefront/StorefrontTrustBar";
import { useStoreDisplay } from "@/hooks/useStoreDisplay";
import { useTenantStore } from "@/hooks/useTenantStore";

const Checkout = () => {
  const { removeFromCart, updateQuantity, getMaxQuantity } = useCart();
  const formRef = useRef<HTMLDivElement>(null);

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

  if (isTenantMode && tenantLoading && !ownerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <StoreThemeProvider colors={themeColors}>
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      <MarketingScripts
        storeSlug={isTenantMode ? storeSlug : undefined}
        storeOwnerId={ownerId}
        disabled={!isTenantMode}
      />
      <CheckoutHeader cartCount={cartCount} backTo={storeHomePath} />
      <StorefrontTrustBar />

      <div className="max-w-xl mx-auto px-4 pb-36">
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
          <form id="checkout-form" onSubmit={handleSubmitOrder}>
            <ScrollReveal>
              <ProgressSteps currentStep={currentStep} />
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="bg-card rounded-2xl border border-border/50 p-4 mt-2">
                <h2 className="text-lg font-bold mb-3 text-right text-foreground">طلبك ({cartCount})</h2>
                <div className="space-y-3">
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
                <div className="flex justify-between mt-4 pt-3 border-t border-border/50">
                  <span className="font-bold text-lg text-foreground">{cartTotal.toLocaleString()} د.ع</span>
                  <span className="font-bold text-foreground">المجموع:</span>
                </div>

                {ownerId && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <p className="text-sm font-medium text-foreground mb-2 text-right">كود الخصم</p>
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
                  <div className="flex justify-between mt-2 text-sm text-primary">
                    <span>-{discountAmount.toLocaleString()} د.ع</span>
                    <span>الخصم ({appliedCoupon?.code})</span>
                  </div>
                )}

                {deliveryPrices.length > 0 && !selectedGovernorate && (
                  <p className="text-xs text-muted-foreground mt-3 text-right">
                    اختر المحافظة لعرض رسوم التوصيل والمجموع النهائي
                  </p>
                )}
              </div>
            </ScrollReveal>

            <ScrollReveal delay={150}>
              <div className="bg-card rounded-2xl border border-border/50 p-4 mt-4">
                <h2 className="text-lg font-bold mb-3 text-right text-foreground">طريقة الدفع</h2>
                <PaymentMethodSelector
                  methods={paymentMethodOptions}
                  selected={selectedPaymentMethod}
                  onSelect={setSelectedPaymentMethod}
                />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="bg-card rounded-2xl border border-border/50 p-4 mt-4" ref={formRef}>
                <h2 className="text-lg font-bold mb-3 text-right text-foreground">معلومات التوصيل</h2>
                <DeliveryForm
                  customerInfo={customerInfo}
                  onInputChange={handleInputChange}
                  selectedGovernorate={selectedGovernorate}
                  onGovernorateChange={handleGovernorateChange}
                  deliveryPrices={deliveryPrices}
                  deliveryFee={deliveryFee}
                  formErrors={formErrors}
                />
              </div>
            </ScrollReveal>

            {selectedGovernorate && (
              <ScrollReveal delay={300}>
                <div className="bg-card rounded-2xl border border-border/50 p-4 mt-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-foreground">
                      {deliveryFee > 0 ? `${deliveryFee.toLocaleString()} د.ع` : "مجاني"}
                    </span>
                    <span className="text-muted-foreground">
                      {deliveryFee > 0
                        ? `رسوم التوصيل (${selectedGovernorate})`
                        : `توصيل مجاني (${selectedGovernorate})`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <span className="font-bold text-lg text-primary">{totalWithDelivery.toLocaleString()} د.ع</span>
                    <span className="font-bold text-foreground">المجموع النهائي</span>
                  </div>
                </div>
              </ScrollReveal>
            )}

            <div className="mt-4">
              <GuaranteesBar />
            </div>

            <ScrollReveal delay={400}>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 rounded-2xl py-3 text-base font-bold h-14 bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "تأكيد الطلب"}
              </Button>
            </ScrollReveal>
          </form>
        )}
      </div>

      {cartItems.length > 0 && (
        <StorefrontFooter
          storeName={display.storeName || 'المتجر'}
          storeSlug={storeSlug}
          whatsappNumber={display.storeSettings.whatsappNumber || tenant.storeInfo?.whatsappNumber}
          returnPolicy={tenant.storeInfo?.returnPolicy}
          privacyPolicy={tenant.storeInfo?.privacyPolicy}
        />
      )}

      {cartItems.length > 0 && !orderCompleted && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/50 p-3 z-30 md:hidden safe-area-bottom"
          dir="rtl"
        >
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <div className="text-right flex-1 min-w-0">
              <span className="text-xs text-muted-foreground">{cartCount} منتج</span>
              <p className="font-bold text-foreground">
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
              size="sm"
              variant="outline"
              className="rounded-xl text-xs shrink-0"
            >
              التوصيل
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => document.getElementById('checkout-form')?.requestSubmit()}
              className="rounded-xl font-bold shrink-0 bg-primary min-h-[44px]"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد'}
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
