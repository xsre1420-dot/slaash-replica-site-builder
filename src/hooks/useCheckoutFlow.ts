import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useTenantStore } from "@/context/TenantStoreContext";
import { useAuth } from "@/context/AuthContext";
import { Order } from "@/types";
import { saveOrderToDatabase } from "@/utils/orderUtils";
import {
  acquireCheckoutSubmitLock,
  releaseCheckoutSubmitLock,
  touchCheckoutSubmitLock,
  getStableCheckoutOrderId,
  loadCompletedCheckoutOrderId,
  markCheckoutCompleted,
  clearCheckoutCompletedMarker,
  clearCheckoutSession,
  persistCheckoutFingerprint,
  pinCheckoutAttempt,
  hasPendingCheckoutAttempt,
  type CheckoutSubmitPhase,
} from "@/utils/checkoutSession";
import { tryRecoverCheckoutOrder } from "@/services/checkoutRecoveryService";
import { mapOrderError } from "@/utils/orderErrors";
import { logger, metrics, reportError, alertOnError, recordHealthEvent } from "@/lib/observability";
import { traceCriticalFlow } from "@/lib/tracing";
import { getStoredMarketingAttribution, clearMarketingAttribution } from "@/lib/attribution";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import {
  fetchFreshProducts,
  fetchCheckoutPreflight,
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
import { flushOwnerCache } from "@/lib/cache";
import { toast } from "sonner";
import { formatPhoneForStorage, isValidIraqiPhone } from "@/utils/phoneUtils";
import { loadCheckoutCustomer, saveCheckoutCustomer } from "@/utils/checkoutCustomer";
import { resolveStoreSlugByOwnerId } from "@/services/storefrontProductService";

const COUPON_STORAGE_KEY = (ownerId: string) => `checkout-coupon:${ownerId}`;

const CHECKOUT_FIELD_IDS: Record<string, string> = {
  name: 'delivery-name',
  phone: 'delivery-phone',
  address: 'delivery-address',
  governorate: 'delivery-governorate',
};

const focusCheckoutField = (field: string) => {
  const el = document.getElementById(CHECKOUT_FIELD_IDS[field] ?? '');
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
};

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

  const [checkoutAlert, setCheckoutAlert] = useState<string | null>(null);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<CheckoutSubmitPhase>('idle');
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
        if (!cancelled) setDeliveryFee(fee != null ? fee : localFee);
      })
      .catch(() => {
        if (!cancelled) setDeliveryFee(localFee);
      });

    return () => { cancelled = true; };
  }, [selectedGovernorate, ownerId, deliveryPrices, checkoutStoreSlug]);

  const discountAmount = appliedCoupon?.discountAmount || 0;
  const totalWithDelivery = computeOrderTotal(cartTotal, deliveryFee, discountAmount);

  const currentStep = useMemo(() => {
    if (cartItems.length === 0) return 0;

    const detailsComplete =
      customerInfo.name.trim() &&
      customerInfo.phone.trim() &&
      customerInfo.address.trim() &&
      (deliveryPrices.length === 0 || selectedGovernorate);

    if (!detailsComplete) return 1;
    return 2;
  }, [
    cartItems.length,
    customerInfo.name,
    customerInfo.phone,
    customerInfo.address,
    selectedGovernorate,
    deliveryPrices.length,
  ]);

  const storeHomePath = isTenantMode ? `/store/${storeSlug}` : "/preview";
  const { trackInitiateCheckout, trackPurchase } = useMetaPixel();
  const checkoutTrackedRef = useRef(false);
  const submitLockRef = useRef(false);
  const submitSucceededRef = useRef(false);
  const finalizeNavigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartFingerprint = buildCartFingerprint(cartItems);

  useEffect(() => {
    return () => {
      if (finalizeNavigateTimerRef.current) {
        clearTimeout(finalizeNavigateTimerRef.current);
        finalizeNavigateTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ownerId) return;

    // Items in cart = new checkout; don't block with a completed marker from a prior order.
    if (cartItems.length > 0) {
      if (loadCompletedCheckoutOrderId(ownerId)) {
        clearCheckoutCompletedMarker(ownerId);
        clearCheckoutSession(ownerId);
        submitSucceededRef.current = false;
        setSubmitPhase('idle');
        setOrderCompleted(false);
        setCompletedOrderId('');
      }
      return;
    }

    const recoveredOrderId = loadCompletedCheckoutOrderId(ownerId);
    if (recoveredOrderId) {
      // Block duplicate submit on revisit with empty cart — do not re-show the success modal.
      submitSucceededRef.current = true;
      setSubmitPhase('success');
      return;
    }

    if (!hasPendingCheckoutAttempt(ownerId)) return;

    let cancelled = false;
    void (async () => {
      const recovered = await tryRecoverCheckoutOrder(ownerId, checkoutStoreSlug);
      if (cancelled || !recovered) return;

      submitSucceededRef.current = true;
      setCompletedOrderId(recovered.orderId);
      setSubmitPhase('success');
      markCheckoutCompleted(ownerId, recovered.orderId);
      clearCart();
      toast.info('تم استلام طلبك مسبقاً — لا حاجة لإعادة الإرسال.');
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerId, checkoutStoreSlug, clearCart, cartItems.length]);

  useEffect(() => {
    if (!isSubmitting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isSubmitting]);

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

        const validation = validateAndRefreshCart(cartItems, freshMap);
        if (cancelled) return;

        if (validation.updatedItems.length === 0 && cartItems.length > 0) {
          toast.error(
            validation.errors[0] ||
              'بعض المنتجات لم تعد متوفرة. حدّث الصفحة أو راجع المخزون في لوحة التحكم.'
          );
          return;
        }

        replaceCartItems(validation.updatedItems);

        if (!cancelled && !validation.valid && validation.updatedItems.length > 0) {
          const stockMsg = validation.errors.find(
            (e) => e.includes('تم تعديل كمية') || e.includes('غير متوفر')
          );
          if (stockMsg) toast.warning(stockMsg);
        }
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
    if (checkoutAlert) setCheckoutAlert(null);
  };

  const handleGovernorateChange = (v: string) => {
    setSelectedGovernorate(v);
    if (formErrors.governorate) setFormErrors((prev) => ({ ...prev, governorate: "" }));
    if (checkoutAlert) setCheckoutAlert(null);
  };

  const validateForm = useCallback((): boolean => {
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
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      const message = errors[firstKey];
      setCheckoutAlert(message);
      toast.error("أكمل بيانات الطلب", {
        id: "checkout-validation",
        description: message,
        duration: 6000,
      });
      focusCheckoutField(firstKey);
      document.getElementById("delivery-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }
    setCheckoutAlert(null);
    return true;
  }, [customerInfo, deliveryPrices.length, selectedGovernorate]);

  const clearCheckoutAlert = useCallback(() => setCheckoutAlert(null), []);

  const finalizeSuccessfulOrder = useCallback(
    (orderId: string, computedTotal: number, validationItems: typeof cartItems, idempotent = false) => {
      submitSucceededRef.current = true;
      submitLockRef.current = false;
      setIsSubmitting(false);
      setSubmitPhase('success');

      if (!idempotent) {
        trackPurchase(
          computedTotal,
          validationItems.map((item) => item.product.id),
          orderId
        );
      }
      clearMarketingAttribution(checkoutStoreSlug);

      // orderService.createOrder already flushed order cache + storefront for the owner
      if (user?.id === ownerId) {
        flushOwnerCache(ownerId);
      }

      setCompletedOrderId(orderId);
      setOrderCompleted(true);
      clearCart();
      sessionStorage.removeItem(COUPON_STORAGE_KEY(ownerId));
      saveCheckoutCustomer(ownerId, {
        name: customerInfo.name.trim(),
        phone: formatPhoneForStorage(customerInfo.phone),
        address: customerInfo.address.trim(),
        notes: customerInfo.notes.trim(),
        governorate: selectedGovernorate || undefined,
      });
      markCheckoutCompleted(ownerId, orderId);
      metrics.increment(idempotent ? 'checkout.submit.recovered' : 'checkout.submit.success');
      recordHealthEvent('checkout', true);
      logger.info('checkout.submit.success', { orderId, ownerId, idempotent });
      toast.success(
        idempotent
          ? 'تم استلام طلبك مسبقاً — لا حاجة لإعادة الإرسال.'
          : 'تم استلام طلبك بنجاح! سنتواصل معك قريباً.'
      );
    },
    [
      checkoutStoreSlug,
      clearCart,
      customerInfo,
      navigate,
      ownerId,
      selectedGovernorate,
      storeHomePath,
      trackPurchase,
      user?.id,
    ]
  );

  const handleSubmitOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) {
      toast.info('جاري معالجة طلبك — انتظر قليلاً');
      return;
    }
    if (!validateForm()) return;
    if (submitSucceededRef.current) {
      toast.info("تم إرسال طلبك مسبقاً");
      return;
    }

    if (!ownerId) {
      toast.error("تعذر تحديد المتجر. يرجى المحاولة مرة أخرى.");
      return;
    }

    if (!acquireCheckoutSubmitLock(ownerId)) {
      toast.info('جاري معالجة طلبك في نافذة أخرى أو تم الإرسال للتو — انتظر قليلاً.');
      return;
    }

    if (!checkoutStoreSlug && isTenantMode) {
      releaseCheckoutSubmitLock(ownerId);
      toast.error("تعذر تحديد المتجر. افتح صفحة المتجر من الرابط الرسمي ثم حاول مرة أخرى.");
      return;
    }

    if (cartItems.length === 0) {
      releaseCheckoutSubmitLock(ownerId);
      toast.error("سلة التسوق فارغة");
      return;
    }

    const selectedOption = paymentMethodOptions.find((m) => m.id === selectedPaymentMethod);
    if (!selectedOption?.available) {
      releaseCheckoutSubmitLock(ownerId);
      toast.error("يرجى اختيار طريقة دفع متاحة");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitPhase('validating');
    metrics.increment('checkout.submit.started');

    await traceCriticalFlow('checkout', 'frontend', 'submit', async (span) => {
    span.setAttribute('ownerId', ownerId);
    span.setAttribute('itemCount', cartItems.length);

    pinCheckoutAttempt(ownerId);

    let releaseLockOnExit = true;

    try {
      const productIds = cartItems.map((i) => i.product.id);
      let freshMap: Map<string, import('@/types').Product>;
      let prefetchedDeliveryFee: number | null = null;
      try {
        if (checkoutStoreSlug) {
          const preflight = await fetchCheckoutPreflight(checkoutStoreSlug, productIds, {
            governorate: selectedGovernorate || undefined,
          });
          if (preflight && preflight.products.size > 0) {
            freshMap = preflight.products;
            prefetchedDeliveryFee = preflight.deliveryFee;
          } else {
            freshMap = await fetchFreshProducts(
              ownerId,
              productIds,
              checkoutStoreSlug ?? undefined,
              { strict: true }
            );
          }
        } else {
          freshMap = await fetchFreshProducts(
            ownerId,
            productIds,
            checkoutStoreSlug ?? undefined,
            { strict: true }
          );
        }
      } catch {
        toast.error("تعذر التحقق من المنتجات. تحقق من الاتصال وحاول مرة أخرى.");
        return;
      }

      const missingProducts = productIds.filter((id) => !freshMap.has(id));
      if (missingProducts.length > 0) {
        toast.error("تعذر التحقق من بعض المنتجات من السيرفر. حدّث الصفحة وحاول مرة أخرى.");
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
      persistCheckoutFingerprint(ownerId, fingerprint);

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
        if (prefetchedDeliveryFee != null && checkoutStoreSlug) {
          feeForOrder = prefetchedDeliveryFee;
        } else {
          try {
            const fetched =
              checkoutStoreSlug
                ? await fetchDeliveryFeeBySlug(checkoutStoreSlug, selectedGovernorate)
                : await fetchDeliveryFee(ownerId, selectedGovernorate);
            feeForOrder =
              fetched != null
                ? fetched
                : calculateDeliveryFeeFromPrices(deliveryPrices, selectedGovernorate);
          } catch {
            feeForOrder = calculateDeliveryFeeFromPrices(deliveryPrices, selectedGovernorate);
          }
        }
      }
      const computedTotal = computeOrderTotal(validation.subtotal, feeForOrder, finalDiscount);

      const normalizedCustomer = {
        name: customerInfo.name.trim(),
        phone: formatPhoneForStorage(customerInfo.phone),
        address: customerInfo.address.trim(),
        notes: customerInfo.notes.trim(),
      };

      const orderId = getStableCheckoutOrderId(ownerId);

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

      setSubmitPhase('creating');
      touchCheckoutSubmitLock(ownerId);

      const savedOrder = await saveOrderToDatabase(
        orderToSave,
        ownerId,
        selectedPaymentMethod,
        couponToApply?.code,
        checkoutStoreSlug,
        getStoredMarketingAttribution(checkoutStoreSlug)
      );

      finalizeSuccessfulOrder(
        savedOrder?.id || orderId,
        computedTotal,
        validation.updatedItems,
        savedOrder?.wasIdempotent === true
      );
      releaseLockOnExit = false;
    } catch (error) {
      metrics.increment('checkout.submit.failed');
      recordHealthEvent('checkout', false, {
        message: error instanceof Error ? error.message : String(error),
      });
      reportError(error, { source: 'checkout.submit', ownerId });
      alertOnError('checkout.submit', error, { ownerId });

      const recovered = await tryRecoverCheckoutOrder(ownerId, checkoutStoreSlug);
      if (recovered) {
        finalizeSuccessfulOrder(
          recovered.orderId,
          recovered.totalAmount,
          cartItems,
          true
        );
        releaseLockOnExit = false;
        return;
      }

      setSubmitPhase('error');

      const rawMessage = error instanceof Error ? error.message : 'فشل في إنشاء الطلب';
      const isStockFailure =
        rawMessage.includes('غير متوفر') ||
        rawMessage.toLowerCase().includes('insufficient stock') ||
        rawMessage.includes('stock_deduction_failed');

      if (isStockFailure && ownerId && cartItems.length > 0) {
        try {
          const productIds = cartItems.map((i) => i.product.id);
          const freshMap = await fetchFreshProducts(
            ownerId,
            productIds,
            checkoutStoreSlug ?? undefined
          );
          const validation = validateAndRefreshCart(cartItems, freshMap);
          replaceCartItems(validation.updatedItems);
        } catch {
          /* ignore refresh failure */
        }
      }

      toast.error(mapOrderError(rawMessage));
    } finally {
      if (releaseLockOnExit && ownerId) {
        releaseCheckoutSubmitLock(ownerId);
        submitLockRef.current = false;
        setIsSubmitting(false);
        if (submitPhase !== 'success') {
          setSubmitPhase('idle');
        }
      }
    }
    });
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
    isTenantMode,
    replaceCartItems,
    finalizeSuccessfulOrder,
    submitPhase,
    validateForm,
  ]);

  const trySubmitCheckout = useCallback(() => {
    void handleSubmitOrder({ preventDefault: () => {} } as React.FormEvent);
  }, [handleSubmitOrder]);

  const dismissOrderSuccess = useCallback(() => {
    if (finalizeNavigateTimerRef.current) {
      clearTimeout(finalizeNavigateTimerRef.current);
      finalizeNavigateTimerRef.current = null;
    }
    setOrderCompleted(false);
    submitSucceededRef.current = false;
    if (ownerId) {
      clearCheckoutCompletedMarker(ownerId);
      clearCheckoutSession(ownerId);
    }
  }, [ownerId]);

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
    handleInputChange,
    handleGovernorateChange,
    handleSubmitOrder,
    trySubmitCheckout,
  };
};
