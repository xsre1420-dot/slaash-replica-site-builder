import { Link } from "react-router-dom";
import { useRef, useEffect, useMemo } from "react";
import { ShoppingBag, Loader2 } from "lucide-react";
import { useCartActions } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import ScrollReveal from "@/components/product-details/ScrollReveal";
import CheckoutHeader from "@/components/checkout/CheckoutHeader";
import CheckoutCartSection from "@/components/checkout/CheckoutCartSection";
import DeliveryForm from "@/components/checkout/DeliveryForm";
import OrderSuccessModal from "@/components/checkout/OrderSuccessModal";
import CheckoutStickyBar from "@/components/checkout/CheckoutStickyBar";
import CheckoutValidationAlert from "@/components/checkout/CheckoutValidationAlert";
import PaymentMethodSelector from "@/components/checkout/PaymentMethodSelector";
import { useCheckoutFlow } from "@/hooks/useCheckoutFlow";
import MarketingScripts from "@/components/MarketingScripts";
import { useStoreVisitTracking } from "@/hooks/useStoreVisitTracking";
import StoreThemeProvider from "@/components/StoreThemeProvider";
import { useStoreDisplay } from "@/hooks/useStoreDisplay";

const Checkout = () => {
  const { removeFromCart, updateQuantity, getMaxQuantity } = useCartActions();
  const formRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef<number | null>(null);

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
    dismissOrderSuccess,
    isSubmitting,
    submitPhase,
    formErrors,
    checkoutAlert,
    clearCheckoutAlert,
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
    trySubmitCheckout,
  } = useCheckoutFlow();

  const display = useStoreDisplay(storeSlug);
  const themeColors = useMemo(
    () => ({
      backgroundColor: display.storeSettings.menuBackgroundColor,
      textColor: display.storeSettings.menuTextColor,
      accentColor: display.storeSettings.menuAccentColor,
      font: display.storeSettings.storeFont,
    }),
    [
      display.storeSettings.menuBackgroundColor,
      display.storeSettings.menuTextColor,
      display.storeSettings.menuAccentColor,
      display.storeSettings.storeFont,
    ]
  );

  useStoreVisitTracking(isTenantMode ? storeSlug : undefined);

  useEffect(() => {
    if (prevStepRef.current !== null && currentStep > prevStepRef.current && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prevStepRef.current = currentStep;
  }, [currentStep]);

  const isCheckoutLocked = isSubmitting || submitPhase === 'creating' || submitPhase === 'validating';

  const submitLabel =
    submitPhase === 'validating'
      ? 'جاري التحقق من السلة...'
      : submitPhase === 'creating'
        ? 'جاري إرسال الطلب...'
        : 'تأكيد الطلب';

  if (isTenantMode && tenantLoading && !ownerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <StoreThemeProvider colors={themeColors} className="min-h-dvh flex flex-col bg-white">
    <div className="flex flex-col flex-1 min-h-dvh w-full bg-white font-arabic" dir="rtl">
      <MarketingScripts
        storeSlug={isTenantMode ? storeSlug : undefined}
        storeOwnerId={ownerId}
        disabled={!isTenantMode}
      />
      <CheckoutHeader
        cartCount={cartCount}
        backTo={storeHomePath}
        storeName={display.storeName}
        storeLogo={display.storeLogo}
        currentStep={currentStep}
        showProgress={cartItems.length > 0}
      />

      <div className="flex-1 w-full px-4 sm:px-6 pt-4 pb-36 space-y-6 md:pb-10 md:max-w-2xl md:mx-auto">
        {checkoutAlert && cartItems.length > 0 && (
          <CheckoutValidationAlert
            message={checkoutAlert}
            onDismiss={clearCheckoutAlert}
          />
        )}
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
          <form
            id="checkout-form"
            onSubmit={handleSubmitOrder}
            className={`space-y-6 ${isCheckoutLocked ? 'pointer-events-none opacity-90' : ''}`}
            aria-busy={isCheckoutLocked}
          >

            <CheckoutCartSection
              cartItems={cartItems}
              cartCount={cartCount}
              cartTotal={cartTotal}
              ownerId={ownerId}
              storeSlug={storeSlug}
              isTenantMode={isTenantMode}
              appliedCoupon={appliedCoupon}
              discountAmount={discountAmount}
              deliveryPrices={deliveryPrices}
              selectedGovernorate={selectedGovernorate}
              getMaxQuantity={getMaxQuantity}
              onRemove={removeFromCart}
              onUpdateQuantity={updateQuantity}
              onApplyCoupon={setAppliedCoupon}
            />

            <ScrollReveal delay={150}>
              <section className="pb-6 border-b border-gray-100">
                <h2 className="text-base font-bold mb-4 text-right text-gray-900">طريقة الدفع</h2>
                <PaymentMethodSelector
                  methods={paymentMethodOptions}
                  selected={selectedPaymentMethod}
                  onSelect={setSelectedPaymentMethod}
                />
              </section>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <section id="delivery-section" className="pb-6 border-b border-gray-100" ref={formRef}>
                <h2 className="text-base font-bold mb-4 text-right text-gray-900">معلومات التوصيل</h2>
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
                <section dir="rtl" className="pb-6 border-b border-gray-100 space-y-3">
                  <h3 className="text-base font-bold text-right text-gray-900">ملخص الدفع</h3>

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

                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100">
                    <span className="text-sm font-bold text-foreground">المجموع النهائي</span>
                    <span className="text-lg font-bold tabular-nums text-primary">
                      {totalWithDelivery.toLocaleString()} د.ع
                    </span>
                  </div>
                </section>
              </ScrollReveal>
            )}

            <div className="hidden md:block">
              <Button
                type="button"
                disabled={isCheckoutLocked}
                onClick={trySubmitCheckout}
                className="w-full rounded-xl py-3 text-sm font-bold h-12 bg-primary hover:bg-primary/90 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.12)] transition-colors"
              >
                {isCheckoutLocked ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {submitLabel}
                  </span>
                ) : (
                  submitLabel
                )}
              </Button>
              {isCheckoutLocked && (
                <p className="text-center text-xs text-muted-foreground mt-2" role="status">
                  لا تغلق الصفحة — يتم معالجة طلبك بأمان
                </p>
              )}
            </div>
          </form>
        )}
        <div className="h-5 shrink-0 bg-white md:h-8" aria-hidden />
      </div>

      {cartItems.length > 0 && !orderCompleted && (
        <CheckoutStickyBar
          cartCount={cartCount}
          displayTotal={
            deliveryPrices.length > 0 && !selectedGovernorate ? cartTotal : totalWithDelivery
          }
          deliveryPending={deliveryPrices.length > 0 && !selectedGovernorate}
          isSubmitting={isCheckoutLocked}
          alertMessage={checkoutAlert}
          onConfirm={trySubmitCheckout}
        />
      )}

      {orderCompleted && (
        <OrderSuccessModal
          orderId={completedOrderId}
          storeSlug={storeSlug}
          whatsappNumber={display.storeSettings.whatsappNumber}
          onDismiss={dismissOrderSuccess}
        />
      )}
    </div>
    </StoreThemeProvider>
  );
};

export default Checkout;
