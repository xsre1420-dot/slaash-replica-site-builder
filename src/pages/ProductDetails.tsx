import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import MarketingScripts from "@/components/MarketingScripts";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useTenantStore } from "@/context/TenantStoreContext";
import { Truck, Shield, RotateCcw, Check, Package, BadgeCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import StoreThemeProvider from "@/components/StoreThemeProvider";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import ProductPurchaseBar from "@/components/storefront/ProductPurchaseBar";
import { getCheckoutPath, getStoreHomePath } from "@/lib/storefrontPaths";
import { resolveStoreOwnerBySlug } from "@/services/storefrontProductService";
import {
  getAvailableQty,
  validateVariantSelection,
  applyActiveDiscount,
  isProductDiscountActive,
} from "@/utils/inventoryUtils";

import ProductHeader from "@/components/product-details/ProductHeader";
import ProductImages from "@/components/product-details/ProductImages";
import ProductQuantity from "@/components/product-details/ProductQuantity";
import CartButton from "@/components/product-details/CartButton";
import ProductData, { type ProductLoadStatus } from "@/components/product-details/ProductData";
import ExpandableSection from "@/components/product-details/ExpandableSection";
import RatingSection from "@/components/product-details/RatingSection";
import SuggestedProducts from "@/components/product-details/SuggestedProducts";
import ScrollReveal from "@/components/product-details/ScrollReveal";
import { useStoreVisitTracking } from "@/hooks/useStoreVisitTracking";
import { useProductViewTracking } from "@/hooks/useProductViewTracking";

// Skeleton loading component
const ProductDetailsSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="bg-card p-4 sticky top-0 z-20 border-b border-border/50">
      <div className="flex justify-between items-center max-w-6xl mx-auto">
        <div className="flex gap-2"><Skeleton className="w-10 h-10 rounded-full" /><Skeleton className="w-10 h-10 rounded-full" /></div>
        <Skeleton className="w-28 h-6" />
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>
    </div>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        <div>
          <Skeleton className="aspect-square lg:aspect-[4/5] rounded-2xl" />
          <div className="flex gap-2 mt-3 lg:hidden">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="w-16 h-16 rounded-xl" />)}
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="w-3/4 h-8" />
          <Skeleton className="w-1/3 h-10" />
          <Skeleton className="w-40 h-8 rounded-full" />
          <Skeleton className="w-full h-12 rounded-xl" />
          <Skeleton className="w-full h-14 rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProductDetails = () => {
  const { productId, username: storeSlug } = useParams<{ productId: string; username?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const previewProduct = (location.state as { previewProduct?: Product } | null)?.previewProduct;
  const initialProduct =
    previewProduct?.id === productId ? previewProduct : null;
  const isTenantMode = !!storeSlug;
  const tenant = useTenantStore(storeSlug);
  const { user } = useAuth();
  const { trackViewContent, trackAddToCart } = useMetaPixel();
  const viewTrackedRef = useRef<string | null>(null);
  const checkoutPath = getCheckoutPath(isTenantMode ? storeSlug : null);
  useStoreVisitTracking(isTenantMode ? storeSlug : undefined);
  useProductViewTracking(isTenantMode ? storeSlug : undefined, productId);
  const [product, setProduct] = useState<Product | null>(null);
  const [productLoadStatus, setProductLoadStatus] = useState<ProductLoadStatus>("loading");
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart, cartCount, cartItems, setStoreOwner } = useCart();
  const { storeSettings, storeName, storeGovernorate } = useStore();

  const themeColors = {
    backgroundColor: isTenantMode
      ? tenant.storeInfo?.menuBackgroundColor || '#ffffff'
      : storeSettings.menuBackgroundColor,
    textColor: isTenantMode
      ? tenant.storeInfo?.menuTextColor || '#333333'
      : storeSettings.menuTextColor,
    accentColor: isTenantMode
      ? tenant.storeInfo?.menuAccentColor || '#6366f1'
      : storeSettings.menuAccentColor,
    font: isTenantMode
      ? tenant.storeInfo?.storeFont || 'Tajawal'
      : storeSettings.storeFont,
  };

  const displayStoreName = isTenantMode ? tenant.storeInfo?.storeName || storeName : storeName;
  const returnPolicy = isTenantMode ? tenant.storeInfo?.returnPolicy : '';
  const privacyPolicy = isTenantMode ? tenant.storeInfo?.privacyPolicy : '';
  const whatsappNumber = isTenantMode ? tenant.storeInfo?.whatsappNumber : '';

  useEffect(() => {
    if (!isTenantMode || !storeSlug) return;
    if (tenant.storeInfo?.ownerId) {
      setStoreOwner(tenant.storeInfo.ownerId);
      return;
    }
    void resolveStoreOwnerBySlug(storeSlug).then((ownerId) => {
      if (ownerId) setStoreOwner(ownerId);
    });
  }, [isTenantMode, storeSlug, tenant.storeInfo?.ownerId, setStoreOwner]);

  useEffect(() => {
    if (initialProduct) {
      setProduct(initialProduct);
      setProductLoadStatus("success");
      return;
    }
    setProduct(null);
    setProductLoadStatus("loading");
  }, [productId, storeSlug, initialProduct]);

  const handleProductLoaded = useCallback((p: Product | null, status: ProductLoadStatus) => {
    setProductLoadStatus(status);
    if (status === "success" && p) setProduct(p);
    if (status === "not_found") setProduct(null);
  }, []);

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cartItems]
  );

  const activeProduct = product ? applyActiveDiscount(product) : null;

  useEffect(() => {
    if (!activeProduct) return;
    if (viewTrackedRef.current === activeProduct.id) return;
    viewTrackedRef.current = activeProduct.id;
    trackViewContent(activeProduct.id, activeProduct.name, activeProduct.price);
  }, [activeProduct, trackViewContent]);

  // Stock availability for selected variant
  const variantAvailable = activeProduct
    ? getAvailableQty(activeProduct, selectedSize || undefined, selectedColor || undefined)
    : 0;

  const tryAddToCart = useCallback((): boolean => {
    if (!activeProduct || isAdding) return false;
    const selection = validateVariantSelection(
      activeProduct,
      selectedSize || undefined,
      selectedColor || undefined
    );
    if (!selection.valid) {
      toast.error(selection.message || "يرجى اختيار خيارات المنتج");
      return false;
    }
    if (variantAvailable <= 0) {
      toast.error("المنتج غير متوفر في المخزون");
      return false;
    }
    if (quantity > variantAvailable) {
      toast.error(`الكمية المتاحة ${variantAvailable} فقط`);
      return false;
    }
    setIsAdding(true);
    addToCart(activeProduct, selectedSize || undefined, selectedColor || undefined, quantity);
    trackAddToCart(activeProduct.id, activeProduct.name, activeProduct.price * quantity);
    toast.success(`تمت إضافة "${activeProduct.name}" إلى السلة`);
    setTimeout(() => setIsAdding(false), 400);
    return true;
  }, [activeProduct, isAdding, selectedSize, selectedColor, variantAvailable, quantity, addToCart, trackAddToCart]);

  const handleAddToCart = () => { tryAddToCart(); };

  const handleBuyNow = () => {
    if (tryAddToCart()) {
      navigate(checkoutPath);
    }
  };

  // Badge logic
  const isNew = product && (product as any).created_at 
    ? (Date.now() - new Date((product as any).created_at).getTime()) < 7 * 24 * 60 * 60 * 1000 
    : false;
  const isLowStock = activeProduct ? variantAvailable > 0 && variantAvailable <= 3 : false;
  const isOutOfStock = activeProduct ? variantAvailable <= 0 : false;
  const hasDiscount = activeProduct && isProductDiscountActive(activeProduct);
  const discountPercent = hasDiscount && product?.discountType === 'percentage' ? product.discountValue : undefined;

  if (productLoadStatus === "not_found") {
    const storeHome = getStoreHomePath(isTenantMode ? storeSlug : null);
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 mb-4 rounded-full bg-muted flex items-center justify-center text-3xl">📦</div>
        <h1 className="text-lg font-bold text-foreground mb-2">المنتج غير موجود</h1>
        <p className="text-sm text-muted-foreground mb-6">
          ربما تم حذف المنتج أو أن الرابط غير صحيح
        </p>
        <button
          type="button"
          onClick={() => navigate(storeHome)}
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          العودة للمتجر
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <>
        <MarketingScripts
          storeSlug={isTenantMode ? storeSlug : undefined}
          storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id}
          disabled={!isTenantMode}
        />
        <ProductData
          productId={productId}
          initialProduct={initialProduct}
          onProductLoaded={handleProductLoaded}
        />
        <ProductDetailsSkeleton />
      </>
    );
  }

  const allImages = product.additionalImages ? [product.image, ...product.additionalImages] : [product.image];

  return (
    <StoreThemeProvider colors={themeColors}>
    <div className="min-h-screen bg-background pb-28 lg:pb-12">
      <MarketingScripts
        storeSlug={isTenantMode ? storeSlug : undefined}
        storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id}
        disabled={!isTenantMode}
      />
      <ProductHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero: gallery + purchase info */}
        <div className="pt-4 sm:pt-6 lg:pt-8 grid lg:grid-cols-2 gap-6 lg:gap-10 xl:gap-14 lg:items-start">
          {/* Gallery — sticky on desktop */}
          <ScrollReveal delay={0} className="lg:sticky lg:top-24">
            <ProductImages
              images={allImages}
              productName={product.name}
              isLarge
              isNew={isNew}
              isLowStock={isLowStock}
              stockQuantity={product.stockQuantity}
              isOutOfStock={isOutOfStock}
              discountPercent={discountPercent}
            />
          </ScrollReveal>

          {/* Product info & purchase */}
          <div className="space-y-5 lg:space-y-6">
            <ScrollReveal delay={50}>
              <div className="space-y-3">
                {product.category && (
                  <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {product.category}
                  </span>
                )}
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-snug text-right">
                  {product.name}
                </h1>

                <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    isOutOfStock
                      ? 'bg-muted text-muted-foreground'
                      : isLowStock
                        ? 'bg-warning/15 text-warning-foreground'
                        : 'bg-green-500/10 text-green-700 dark:text-green-400'
                  }`}>
                    <Package className="w-3.5 h-3.5" />
                    {isOutOfStock
                      ? 'غير متوفر حالياً'
                      : isLowStock
                        ? `متبقي ${variantAvailable} قطع فقط`
                        : `متوفر — ${variantAvailable} قطعة`}
                  </div>

                  <div className="text-left">
                    {hasDiscount && product.originalPrice ? (
                      <div className="flex flex-col items-start">
                        <span className="text-sm text-muted-foreground line-through">
                          {product.originalPrice.toLocaleString()} د.ع
                        </span>
                        <span className="text-2xl sm:text-3xl font-bold text-destructive">
                          {product.price.toLocaleString()} د.ع
                        </span>
                        {discountPercent && (
                          <span className="inline-block bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-lg font-bold mt-1">
                            وفّر {discountPercent}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-2xl sm:text-3xl font-bold text-foreground">
                        {product.price.toLocaleString()} د.ع
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Short description preview on desktop */}
            {product.description && (
              <ScrollReveal delay={80} className="hidden lg:block">
                <p className="text-sm text-muted-foreground leading-relaxed text-right line-clamp-3">
                  {product.description}
                </p>
              </ScrollReveal>
            )}

            {product.sizes && product.sizes.length > 0 && (
              <ScrollReveal delay={100}>
                <div className="space-y-2.5 rounded-xl border border-border/40 p-4 bg-card/50">
                  <h3 className="text-sm font-semibold text-foreground text-right">المقاس</h3>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {product.sizes.map((size, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 min-h-[44px] ${
                          selectedSize === size
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        {selectedSize === size && <Check className="w-3 h-3 inline ml-1" />}
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            )}

            {product.colors && product.colors.length > 0 && (
              <ScrollReveal delay={150}>
                <div className="space-y-2.5 rounded-xl border border-border/40 p-4 bg-card/50">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">اللون</h3>
                    {selectedColor && (
                      <span className="text-xs text-muted-foreground">
                        {product.colors.find(c => c.value === selectedColor)?.name || 'محدد'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2.5 justify-end">
                    {product.colors.map((color, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedColor(selectedColor === color.value ? "" : color.value)}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 transition-all duration-200 relative overflow-hidden ${
                          selectedColor === color.value
                            ? 'border-primary border-2 scale-105'
                            : 'border-border hover:border-primary/30'
                        }`}
                        style={{ backgroundColor: color.value }}
                        aria-label={color.name || 'لون'}
                      >
                        {color.image && (
                          <img src={color.image} alt="" className="w-full h-full object-cover" />
                        )}
                        {selectedColor === color.value && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            )}

            <ScrollReveal delay={200}>
              <div className="rounded-xl border border-border/40 p-4 bg-card/50 space-y-4">
                <div className="flex items-center justify-between">
                  <ProductQuantity
                    quantity={quantity}
                    onIncrement={() => setQuantity((prev) => Math.min(prev + 1, Math.max(variantAvailable, 1)))}
                    onDecrement={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  />
                  <h3 className="text-sm font-semibold text-foreground">الكمية</h3>
                </div>
                <div className="hidden sm:flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isAdding || isOutOfStock}
                    className="flex-1 h-12 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 disabled:opacity-50 transition-colors"
                  >
                    أضف للسلة
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={isAdding || isOutOfStock}
                    className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50 transition-opacity"
                  >
                    اشتري الآن
                  </button>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={250} animation="slide-up">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { icon: <Truck className="w-5 h-5" />, label: "توصيل سريع" },
                  { icon: <Shield className="w-5 h-5" />, label: "دفع آمن" },
                  { icon: <RotateCcw className="w-5 h-5" />, label: returnPolicy ? "إرجاع متاح" : "ضمان الجودة" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 py-3 bg-muted/40 rounded-xl border border-border/30">
                    <span className="text-primary">{item.icon}</span>
                    <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground text-center leading-tight">{item.label}</span>
                  </div>
                ))}
              </div>
              {isTenantMode && (
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-primary shrink-0" />
                  متجر موثوق — الدفع عند الاستلام متاح
                </p>
              )}
            </ScrollReveal>

            {returnPolicy && (
              <ScrollReveal delay={280} className="hidden lg:block">
                <ExpandableSection title="سياسة الإرجاع والشحن" defaultOpen={false}>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{returnPolicy}</p>
                </ExpandableSection>
              </ScrollReveal>
            )}
          </div>
        </div>

        {/* Full-width content below hero */}
        <div className="mt-8 lg:mt-12 space-y-6 lg:space-y-8 pb-6">
          {returnPolicy && (
            <ScrollReveal delay={290} className="lg:hidden">
              <ExpandableSection title="سياسة الإرجاع والشحن" defaultOpen={false}>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{returnPolicy}</p>
              </ExpandableSection>
            </ScrollReveal>
          )}

          {product.description && (
            <ScrollReveal delay={300}>
              <div className="lg:hidden">
                <ExpandableSection title="الوصف" defaultOpen>
                  <div className="rounded-xl bg-muted/30 p-4 border border-border/30">
                    <p className="text-muted-foreground leading-relaxed text-sm whitespace-pre-wrap">{product.description}</p>
                  </div>
                </ExpandableSection>
              </div>
              <div className="hidden lg:block rounded-2xl border border-border/50 bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40 bg-muted/20">
                  <h2 className="text-lg font-bold text-foreground text-right">وصف المنتج</h2>
                </div>
                <div className="p-6">
                  <p className="text-muted-foreground leading-loose text-base whitespace-pre-wrap text-right">
                    {product.description}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          )}

          <ScrollReveal delay={350}>
            <RatingSection productId={productId || ""} storeSlug={storeSlug} />
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <SuggestedProducts currentProductId={productId || ""} storeSlug={storeSlug} category={product.category} />
          </ScrollReveal>
        </div>

        <StorefrontFooter
          storeName={displayStoreName || 'المتجر'}
          storeSlug={storeSlug}
          ownerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id}
          governorate={storeGovernorate}
          whatsappNumber={whatsappNumber}
          returnPolicy={returnPolicy}
          privacyPolicy={privacyPolicy}
        />
      </div>

      <ProductPurchaseBar
        price={activeProduct?.price || product.price}
        quantity={quantity}
        isOutOfStock={isOutOfStock}
        isAdding={isAdding}
        checkoutPath={checkoutPath}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        className="sm:hidden"
      />

      {cartCount > 0 && (
        <div className="hidden sm:block">
          <div className="h-24" />
          <CartButton cartCount={cartCount} totalAmount={totalAmount} checkoutPath={checkoutPath} storeSlug={storeSlug} />
        </div>
      )}
    </div>
    </StoreThemeProvider>
  );
};

export default ProductDetails;
