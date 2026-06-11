import { Link, useNavigate, useParams } from "react-router-dom";

import { useState, useRef, useEffect, useMemo } from "react";

import { ShoppingBag, Loader2 } from "lucide-react";

import { useCart } from "@/context/CartContext";

import { useStore } from "@/context/StoreContext";

import { useTenantStore } from "@/hooks/useTenantStore";

import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/ui/button";

import { Order } from "@/types";

import { saveOrderToDatabase } from "@/utils/orderUtils";

import { toast } from "sonner";

import ScrollReveal from "@/components/product-details/ScrollReveal";

import CheckoutHeader from "@/components/checkout/CheckoutHeader";

import ProgressSteps from "@/components/checkout/ProgressSteps";

import CartItemCard from "@/components/checkout/CartItemCard";

import DeliveryForm from "@/components/checkout/DeliveryForm";

import GuaranteesBar from "@/components/checkout/GuaranteesBar";

import OrderSuccessModal from "@/components/checkout/OrderSuccessModal";
import CouponInput, { AppliedCoupon } from "@/components/checkout/CouponInput";

const Checkout = () => {
  const { username: storeSlug } = useParams<{ username?: string }>();

  const isTenantMode = !!storeSlug;

  const tenant = useTenantStore(storeSlug);

  const { user } = useAuth();

  const { cartItems, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount, storeOwnerId, setStoreOwner } = useCart();

  const { storeSettings } = useStore();

  const navigate = useNavigate();

  const formRef = useRef<HTMLDivElement>(null);



  const [orderCompleted, setOrderCompleted] = useState(false);

  const [completedOrderId, setCompletedOrderId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "", address: "", notes: "" });
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const deliveryPrices = useMemo(() => {
    if (isTenantMode && tenant.storeInfo?.deliveryPrices?.length) {

      return tenant.storeInfo.deliveryPrices;

    }

    return storeSettings.deliveryPrices || [];

  }, [isTenantMode, tenant.storeInfo, storeSettings.deliveryPrices]);



  const ownerId = useMemo(() => {

    if (isTenantMode) return tenant.storeInfo?.ownerId || storeOwnerId;

    return user?.id || storeOwnerId;

  }, [isTenantMode, tenant.storeInfo, storeOwnerId, user?.id]);



  useEffect(() => {

    if (ownerId) setStoreOwner(ownerId);

  }, [ownerId, setStoreOwner]);



  const selectedDeliveryPrice = selectedGovernorate

    ? deliveryPrices.find(d => d.governorate === selectedGovernorate)?.price || 0

    : 0;

  const discountAmount = appliedCoupon?.discountAmount || 0;
  const totalWithDelivery = Math.max(0, cartTotal - discountAmount) + selectedDeliveryPrice;



  const storeHomePath = isTenantMode ? `/store/${storeSlug}` : "/preview";

  const successRedirectPath = storeHomePath;



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {

    const { name, value } = e.target;

    setCustomerInfo(prev => ({ ...prev, [name]: value }));

    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: "" }));

  };



  const handleGovernorateChange = (v: string) => {

    setSelectedGovernorate(v);

    if (formErrors.governorate) setFormErrors(prev => ({ ...prev, governorate: "" }));

  };



  const validateForm = (): boolean => {

    const errors: Record<string, string> = {};

    if (!customerInfo.name.trim()) errors.name = "يرجى إدخال الاسم";

    if (!customerInfo.phone.trim()) errors.phone = "يرجى إدخال رقم الهاتف";

    else if (!/^[\d\s+()-]{7,15}$/.test(customerInfo.phone.trim())) errors.phone = "رقم الهاتف غير صحيح";

    if (!customerInfo.address.trim()) errors.address = "يرجى إدخال العنوان";

    if (deliveryPrices.length && !selectedGovernorate) errors.governorate = "يرجى اختيار المحافظة";

    setFormErrors(errors);

    return Object.keys(errors).length === 0;

  };



  const handleSubmitOrder = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!validateForm() || isSubmitting) return;



    if (!ownerId) {

      toast.error("تعذر تحديد المتجر. يرجى المحاولة مرة أخرى.");

      return;

    }



    if (cartItems.length === 0) {

      toast.error("سلة التسوق فارغة");

      return;

    }



    setIsSubmitting(true);



    try {

      const orderId = typeof crypto !== 'undefined' && 'randomUUID' in crypto

        ? crypto.randomUUID()

        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;



      const orderToSave: Order = {

        id: orderId,

        items: cartItems,

        customerInfo: {

          name: customerInfo.name,

          phone: customerInfo.phone,

          address: customerInfo.address,

          notes: customerInfo.notes || undefined,

          governorate: selectedGovernorate || undefined,

        },

        total: totalWithDelivery,

        date: new Date().toISOString(),

        status: 'pending',

      };



      const savedOrder = await saveOrderToDatabase(
        orderToSave,
        ownerId,
        'cash_on_delivery',
        appliedCoupon?.code
      );

      setCompletedOrderId(savedOrder?.id || orderId);

      setOrderCompleted(true);

      clearCart();



      setTimeout(() => {

        setOrderCompleted(false);

        navigate(successRedirectPath);

      }, 3000);

    } catch (error) {

      console.error('Error submitting order:', error);

      toast.error('فشل في إنشاء الطلب. يرجى المحاولة مرة أخرى.');

    } finally {

      setIsSubmitting(false);

    }

  };



  if (isTenantMode && tenant.loading) {

    return (

      <div className="min-h-screen flex items-center justify-center bg-background">

        <Loader2 className="w-8 h-8 animate-spin text-primary" />

      </div>

    );

  }



  return (

    <div className="min-h-screen bg-background font-arabic" dir="rtl">

      <CheckoutHeader cartCount={cartCount} />



      <div className="max-w-xl mx-auto px-4 pb-32">

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

          <form onSubmit={handleSubmitOrder}>

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

                  formErrors={formErrors}

                />

              </div>

            </ScrollReveal>



            {selectedGovernorate && selectedDeliveryPrice > 0 && (

              <ScrollReveal delay={300}>

                <div className="bg-card rounded-2xl border border-border/50 p-4 mt-4 space-y-3">

                  <div className="flex justify-between items-center text-sm">

                    <span className="text-foreground">{selectedDeliveryPrice.toLocaleString()} د.ع</span>

                    <span className="text-muted-foreground">رسوم التوصيل ({selectedGovernorate})</span>

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

                {isSubmitting ? (

                  <Loader2 className="w-5 h-5 animate-spin" />

                ) : (

                  "تأكيد الطلب"

                )}

              </Button>

            </ScrollReveal>

          </form>

        )}

      </div>



      {cartItems.length > 0 && !orderCompleted && (

        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/50 p-3 z-30 md:hidden animate-slide-up-sticky" dir="rtl">

          <div className="max-w-xl mx-auto flex items-center justify-between">

            <div className="text-right">

              <span className="text-xs text-muted-foreground">{cartCount} منتج</span>

              <p className="font-bold text-foreground">

                {(selectedDeliveryPrice > 0 ? totalWithDelivery : cartTotal).toLocaleString()} د.ع

              </p>

            </div>

            <Button

              onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}

              size="sm"

              variant="outline"

              className="rounded-xl text-xs"

            >

              معلومات التوصيل ↓

            </Button>

          </div>

        </div>

      )}



      {orderCompleted && <OrderSuccessModal orderId={completedOrderId} />}

    </div>

  );

};



export default Checkout;


