import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useTenantStore } from "@/hooks/useTenantStore";
import { useAuth } from "@/context/AuthContext";
import { Order } from "@/types";
import { saveOrderToDatabase, clearCheckoutIdempotencyKey } from "@/utils/orderUtils";
import { mapOrderError } from "@/utils/orderErrors";
import { logger, metrics, reportError, alertOnError } from "@/lib/observability";
import { getStoredMarketingAttribution, clearMarketingAttribution } from "@/lib/attribution";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import {
  fetchFreshProducts,
  validateAndRefreshCart,
  revalidateCoupon,
  buildCartFingerprint,
} from "@/utils/checkoutValidation";
import { AppliedCoupon } from "@/services/couponService";
import { fetchDeliveryFee, fetchDeliveryFeeBySlug } from "@/services/deliveryService";
import { calculateDeliveryFeeFromPrices, computeOrderTotal } from "@/utils/deliveryUtils";
import {
  buildPaymentMethodOptions,
  parseEnabledPaymentMethods,
  PaymentMethodId,
} from "@/utils/paymentUtils";
import { cache } from "@/lib/cache";
import { toast } from "sonner";

const COUPON_STORAGE_KEY = (ownerId: string) => `checkout-coupon:${ownerId}`;

export const useCheckoutFlow = () => {
  const { username: storeSlug } = useParams<{ username?: string }>();
  const isTenantMode = !!storeSlug;
  const tenant = useTenantStore(storeSlug);
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    cartItems,
    replaceCartItems,
    clearCart,
    cartTotal,
    cartCount,
    storeOwnerId,
    setStoreOwner,
  } = useCart();
  const { storeSettings } = useStore();

  const [orderCompleted, setOrderCompleted] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "", address: "", notes: "" });
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodId>("cash_on_delivery");
  const [deliveryFee, setDeliveryFee] = useState(0);

  const paymentMethodOptions = useMemo(() => {
    const raw = isTenantMode
      ? tenant.storeInfo?.paymentMethods
      : storeSettings.paymentMethods;
    return buildPaymentMethodOptions(parseEnabledPaymentMethods(raw));
  }, [isTenantMode, tenant.storeInfo?.paymentMethods, storeSettings.paymentMethods]);

  useEffect(() => {
    const firstAvailable = paymentMethodOptions.find((m) => m.available);
    if (firstAvailable) setSelectedPaymentMethod(firstAvailable.id);
  }, [paymentMethodOptions]);

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

  useEffect(() => {
    if (!ownerId) return;
    try {
      const saved = sessionStorage.getItem(COUPON_STORAGE_KEY(ownerId));
      if (saved) setAppliedCoupon(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    if (appliedCoupon) {
      sessionStorage.setItem(COUPON_STORAGE_KEY(ownerId), JSON.stringify(appliedCoupon));
    } else {
      sessionStorage.removeItem(COUPON_STORAGE_KEY(ownerId));
    }
  }, [appliedCoupon, ownerId]);

  useEffect(() => {
    if (!selectedGovernorate || !ownerId) {
      setDeliveryFee(0);
      return;
    }

    let cancelled = false;
    const localFee = calculateDeliveryFeeFromPrices(deliveryPrices, selectedGovernorate);

    const feePromise = isTenantMode && storeSlug
      ? fetchDeliveryFeeBySlug(storeSlug, selectedGovernorate)
      : fetchDeliveryFee(ownerId, selectedGovernorate);

    feePromise
      .then((fee) => {
        if (!cancelled) setDeliveryFee(fee > 0 ? fee : localFee);
      })
      .catch(() => {
        if (!cancelled) setDeliveryFee(localFee);
      });

    return () => { cancelled = true; };
  }, [selectedGovernorate, ownerId, deliveryPrices, isTenantMode, storeSlug]);

  const discountAmount = appliedCoupon?.discountAmount || 0;
  const totalWithDelivery = computeOrderTotal(cartTotal, deliveryFee, discountAmount);

  const currentStep = useMemo(() => {
    if (!customerInfo.name.trim() || !customerInfo.phone.trim()) return 0;
    if (!selectedGovernorate && deliveryPrices.length > 0) return 1;
    return 2;
  }, [customerInfo.name, customerInfo.phone, selectedGovernorate, deliveryPrices.length]);

  const storeHomePath = isTenantMode ? `/store/${storeSlug}` : "/preview";
  const { trackInitiateCheckout, trackPurchase } = useMetaPixel();
  const checkoutTrackedRef = useRef(false);

  useEffect(() => {
    if (cartItems.length === 0 || checkoutTrackedRef.current) return;
    checkoutTrackedRef.current = true;
    trackInitiateCheckout(
      totalWithDelivery,
      cartItems.map((item) => item.product.id)
    );
  }, [cartItems, totalWithDelivery, trackInitiateCheckout]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCustomerInfo((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleGovernorateChange = (v: string) => {
    setSelectedGovernorate(v);
    if (formErrors.governorate) setFormErrors((prev) => ({ ...prev, governorate: "" }));
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

  const handleSubmitOrder = useCallback(async (e: React.FormEvent) => {
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

    const selectedOption = paymentMethodOptions.find((m) => m.id === selectedPaymentMethod);
    if (!selectedOption?.available) {
      toast.error("يرجى اختيار طريقة دفع متاحة");
      return;
    }

    setIsSubmitting(true);
    metrics.increment('checkout.submit.started');

    try {
      const productIds = cartItems.map((i) => i.product.id);
      let freshMap: Map<string, import('@/types').Product>;
      try {
        freshMap = await fetchFreshProducts(ownerId, productIds);
      } catch {
        toast.error("تعذر التحقق من المنتجات. تحقق من الاتصال وحاول مرة أخرى.");
        return;
      }

      const validation = validateAndRefreshCart(cartItems, freshMap);
      validation.errors.forEach((msg) => toast.warning(msg));

      if (validation.updatedItems.length === 0) {
        toast.error("لا توجد منتجات صالحة في السلة");
        return;
      }

      replaceCartItems(validation.updatedItems);

      const fingerprint = buildCartFingerprint(validation.updatedItems);
      const prevFingerprint = sessionStorage.getItem(`checkout-fingerprint:${ownerId}`);
      if (prevFingerprint && prevFingerprint !== fingerprint) {
        clearCheckoutIdempotencyKey(ownerId);
      }
      sessionStorage.setItem(`checkout-fingerprint:${ownerId}`, fingerprint);

      let couponToApply = appliedCoupon;
      if (appliedCoupon) {
        const revalidated = await revalidateCoupon(
          ownerId,
          appliedCoupon.code,
          validation.subtotal,
          isTenantMode ? storeSlug : undefined
        );
        if (!revalidated) {
          setAppliedCoupon(null);
          couponToApply = null;
          toast.warning("كود الخصم لم يعد صالحاً وتم إزالته");
        } else {
          couponToApply = revalidated;
          setAppliedCoupon(revalidated);
        }
      }

      const finalDiscount = couponToApply?.discountAmount || 0;
      const feeForOrder = selectedGovernorate
        ? isTenantMode && storeSlug
          ? await fetchDeliveryFeeBySlug(storeSlug, selectedGovernorate).catch(() =>
              calculateDeliveryFeeFromPrices(deliveryPrices, selectedGovernorate)
            )
          : ownerId
            ? await fetchDeliveryFee(ownerId, selectedGovernorate).catch(() =>
                calculateDeliveryFeeFromPrices(deliveryPrices, selectedGovernorate)
              )
            : calculateDeliveryFeeFromPrices(deliveryPrices, selectedGovernorate)
        : 0;
      const computedTotal = computeOrderTotal(validation.subtotal, feeForOrder, finalDiscount);

      const orderId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const orderToSave: Order = {
        id: orderId,
        items: validation.updatedItems,
        customerInfo: {
          name: customerInfo.name,
          phone: customerInfo.phone,
          address: customerInfo.address,
          notes: customerInfo.notes || undefined,
          governorate: selectedGovernorate || undefined,
        },
        total: computedTotal,
        date: new Date().toISOString(),
        status: "pending",
        couponCode: couponToApply?.code,
        discountAmount: finalDiscount,
        paymentMethod: selectedPaymentMethod,
        deliveryFee: feeForOrder,
      };

      const savedOrder = await saveOrderToDatabase(
        orderToSave,
        ownerId,
        selectedPaymentMethod,
        couponToApply?.code,
        isTenantMode ? storeSlug : null,
        getStoredMarketingAttribution(isTenantMode ? storeSlug : null)
      );

      trackPurchase(
        computedTotal,
        validation.updatedItems.map((item) => item.product.id),
        savedOrder?.id || orderId
      );
      clearMarketingAttribution(isTenantMode ? storeSlug : null);

      if (isTenantMode && storeSlug) {
        cache.del(`tenant-meta:${storeSlug.trim().toLowerCase()}`);
        cache.flushByPrefix(`tenant-products:${storeSlug.trim().toLowerCase()}:`);
      }

      setCompletedOrderId(savedOrder?.id || orderId);
      setOrderCompleted(true);
      clearCart();
      sessionStorage.removeItem(COUPON_STORAGE_KEY(ownerId));
      metrics.increment('checkout.submit.success');
      logger.info('checkout.submit.success', { orderId: savedOrder?.id || orderId, ownerId });

      setTimeout(() => {
        setOrderCompleted(false);
        navigate(storeHomePath);
      }, 3000);
    } catch (error) {
      metrics.increment('checkout.submit.failed');
      reportError(error, { source: 'checkout.submit', ownerId });
      alertOnError('checkout.submit', error, { ownerId });
      toast.error(mapOrderError(error instanceof Error ? error.message : "فشل في إنشاء الطلب"));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    ownerId,
    cartItems,
    paymentMethodOptions,
    selectedPaymentMethod,
    appliedCoupon,
    selectedGovernorate,
    deliveryPrices,
    customerInfo,
    isTenantMode,
    storeSlug,
    replaceCartItems,
    clearCart,
    navigate,
    storeHomePath,
    trackPurchase,
  ]);

  return {
    isTenantMode,
    storeSlug,
    tenantLoading: tenant.loading,
    cartItems,
    cartTotal,
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
    handleInputChange,
    handleGovernorateChange,
    handleSubmitOrder,
  };
};
