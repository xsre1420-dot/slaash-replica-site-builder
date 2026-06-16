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
  refreshCartFromServer,
  revalidateCoupon,
  buildCartFingerprint,
  isFatalCheckoutError,
} from "@/utils/checkoutValidation";
import { persistCheckoutStoreSlug, loadCheckoutStoreSlug } from "@/lib/checkoutStoreContext";
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
import { generateUUID } from "@/lib/uuid";
import { formatPhoneForStorage, isValidIraqiPhone } from "@/utils/phoneUtils";
import { loadCheckoutCustomer, saveCheckoutCustomer } from "@/utils/checkoutCustomer";
import { resolveStoreSlugByOwnerId } from "@/services/storefrontProductService";
import { flushOwnerCache } from "@/lib/cache";

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
  const [checkoutStoreSlug, setCheckoutStoreSlug] = useState<string | null>(storeSlug ?? null);
  const customerHydratedRef = useRef(false);

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
    if (storeSlug) {
      setCheckoutStoreSlug(storeSlug);
      if (ownerId) persistCheckoutStoreSlug(ownerId, storeSlug);
      return;
    }
    if (!ownerId) {
      setCheckoutStoreSlug(null);
      return;
    }
    const savedSlug = loadCheckoutStoreSlug(ownerId);
    if (savedSlug) {
      setCheckoutStoreSlug(savedSlug);
      return;
    }
    let cancelled = false;
    resolveStoreSlugByOwnerId(ownerId).then((slug) => {
      if (!cancelled) {
        setCheckoutStoreSlug(slug);
        if (slug) persistCheckoutStoreSlug(ownerId, slug);
      }
    });
    return () => { cancelled = true; };
  }, [storeSlug, ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    customerHydratedRef.current = false;
    const saved = loadCheckoutCustomer(ownerId);
    if (saved) {
      setCustomerInfo({
        name: saved.name,
        phone: saved.phone,
        address: saved.address,
        notes: saved.notes,
      });
      if (saved.governorate) setSelectedGovernorate(saved.governorate);
    }
    customerHydratedRef.current = true;
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId || !customerHydratedRef.current) return;
    saveCheckoutCustomer(ownerId, {
      ...customerInfo,
      governorate: selectedGovernorate || undefined,
    });
  }, [ownerId, customerInfo, selectedGovernorate]);

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

    const feePromise = checkoutStoreSlug
      ? fetchDeliveryFeeBySlug(checkoutStoreSlug, selectedGovernorate)
      : fetchDeliveryFee(ownerId, selectedGovernorate);

    feePromise
      .then((fee) => {
        if (!cancelled) setDeliveryFee(Number.isFinite(fee) ? fee : localFee);
      })
      .catch(() => {
        if (!cancelled) setDeliveryFee(localFee);
      });

    return () => { cancelled = true; };
  }, [selectedGovernorate, ownerId, deliveryPrices, checkoutStoreSlug]);

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
  const submitLockRef = useRef(false);
  const cartFingerprint = buildCartFingerprint(cartItems);

  useEffect(() => {
    if (!ownerId || cartItems.length === 0) return;

    let cancelled = false;
    const cartFallback = new Map(cartItems.map((i) => [i.product.id, i.product]));
    const syncCartPrices = async () => {
      try {
        const productIds = cartItems.map((i) => i.product.id);
        const freshMap = await fetchFreshProducts(
          ownerId,
          productIds,
          checkoutStoreSlug ?? undefined,
          { cartFallback }
        );
        if (cancelled) return;

        const refreshed = refreshCartFromServer(cartItems, freshMap);
        replaceCartItems(refreshed);
      } catch {
        if (!cancelled) {
          toast.warning("تعذر تحديث أسعار السلة. سيتم التحقق عند تأكيد الطلب.");
        }
      }
    };

    void syncCartPrices();
    return () => { cancelled = true; };
  }, [ownerId, cartFingerprint, checkoutStoreSlug, replaceCartItems]);

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
    const name = customerInfo.name.trim();
    const phone = customerInfo.phone.trim();
    const address = customerInfo.address.trim();

    if (!name) errors.name = "يرجى إدخال الاسم";
    if (!phone) errors.phone = "يرجى إدخال رقم الهاتف";
    else if (!isValidIraqiPhone(phone)) errors.phone = "رقم الهاتف غير صحيح (مثال: 07701234567)";
    if (!address) errors.address = "يرجى إدخال العنوان";
    if (deliveryPrices.length && !selectedGovernorate) errors.governorate = "يرجى اختيار المحافظة";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;
    if (!validateForm()) return;

    if (!checkoutStoreSlug && isTenantMode) {
      toast.error("تعذر تحديد المتجر. افتح صفحة المتجر من الرابط الرسمي ثم حاول مرة أخرى.");
      return;
    }

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

    submitLockRef.current = true;
    setIsSubmitting(true);
    metrics.increment('checkout.submit.started');

    try {
      const productIds = cartItems.map((i) => i.product.id);
      const cartFallback = new Map(cartItems.map((i) => [i.product.id, i.product]));
      let freshMap: Map<string, import('@/types').Product>;
      try {
        freshMap = await fetchFreshProducts(
          ownerId,
          productIds,
          checkoutStoreSlug ?? undefined,
          { cartFallback }
        );
      } catch {
        toast.error("تعذر التحقق من المنتجات. تحقق من الاتصال وحاول مرة أخرى.");
        return;
      }

      const validation = validateAndRefreshCart(cartItems, freshMap);

      if (validation.updatedItems.length === 0) {
        toast.error(
          validation.errors[0] ||
            "لا توجد منتجات صالحة في السلة. راجع المخزون وحاول مرة أخرى."
        );
        return;
      }

      const fatalErrors = validation.errors.filter(isFatalCheckoutError);
      if (fatalErrors.length > 0) {
        toast.error(fatalErrors.join(' · '));
        replaceCartItems(validation.updatedItems);
        return;
      }

      if (!validation.valid) {
        validation.errors.forEach((msg) => toast.warning(msg));
        replaceCartItems(validation.updatedItems);
        toast.info("تم تحديث السلة — راجع الكميات ثم أكّد الطلب مرة أخرى.");
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
          checkoutStoreSlug ?? undefined
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
      let feeForOrder = 0;
      if (selectedGovernorate) {
        try {
          feeForOrder =
            checkoutStoreSlug
              ? await fetchDeliveryFeeBySlug(checkoutStoreSlug, selectedGovernorate)
              : await fetchDeliveryFee(ownerId, selectedGovernorate);
        } catch {
          feeForOrder = calculateDeliveryFeeFromPrices(deliveryPrices, selectedGovernorate);
        }
      }
      const computedTotal = computeOrderTotal(validation.subtotal, feeForOrder, finalDiscount);

      const normalizedCustomer = {
        name: customerInfo.name.trim(),
        phone: formatPhoneForStorage(customerInfo.phone),
        address: customerInfo.address.trim(),
        notes: customerInfo.notes.trim(),
      };

      const orderId = generateUUID();

      const orderToSave: Order = {
        id: orderId,
        items: validation.updatedItems,
        customerInfo: {
          name: normalizedCustomer.name,
          phone: normalizedCustomer.phone,
          address: normalizedCustomer.address,
          notes: normalizedCustomer.notes || undefined,
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
        checkoutStoreSlug,
        getStoredMarketingAttribution(checkoutStoreSlug)
      );

      trackPurchase(
        computedTotal,
        validation.updatedItems.map((item) => item.product.id),
        savedOrder?.id || orderId
      );
      clearMarketingAttribution(checkoutStoreSlug);

      if (checkoutStoreSlug) {
        cache.del(`tenant-meta:${checkoutStoreSlug.trim().toLowerCase()}`);
        cache.flushByPrefix(`tenant-products:${checkoutStoreSlug.trim().toLowerCase()}:`);
      }

      if (user?.id === ownerId) {
        flushOwnerCache(ownerId);
      }

      setCompletedOrderId(savedOrder?.id || orderId);
      setOrderCompleted(true);
      clearCart();
      sessionStorage.removeItem(COUPON_STORAGE_KEY(ownerId));
      saveCheckoutCustomer(ownerId, {
        name: normalizedCustomer.name,
        phone: normalizedCustomer.phone,
        address: normalizedCustomer.address,
        notes: normalizedCustomer.notes,
        governorate: selectedGovernorate || undefined,
      });
      clearCheckoutIdempotencyKey(ownerId);
      metrics.increment('checkout.submit.success');
      logger.info('checkout.submit.success', { orderId: savedOrder?.id || orderId, ownerId });
      toast.success("تم استلام طلبك بنجاح! سنتواصل معك قريباً.");

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
      submitLockRef.current = false;
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
    checkoutStoreSlug,
    user?.id,
    isTenantMode,
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
