import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import MarketingScripts from "@/components/MarketingScripts";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useTenantStore } from "@/hooks/useTenantStore";
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
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex gap-2"><Skeleton className="w-9 h-9 rounded-full" /><Skeleton className="w-9 h-9 rounded-full" /></div>
        <Skeleton className="w-28 h-6" />
        <Skeleton className="w-9 h-9 rounded-full" />
      </div>
    </div>
    <div className="max-w-md mx-auto bg-card">
      <div className="px-4 pt-4">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="flex gap-2 justify-center mt-3">
          {[1,2,3].map(i => <Skeleton key={i} className="w-14 h-14 rounded-xl" />)}
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex justify-between">
          <Skeleton className="w-28 h-8" />
          <Skeleton className="w-36 h-6" />
        </div>
        <Skeleton className="w-full h-12 rounded-lg" />
        <div className="flex gap-2 justify-end">
          {[1,2,3].map(i => <Skeleton key={i} className="w-16 h-10 rounded-xl" />)}
        </div>
        <Skeleton className="w-full h-14 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    </div>
  </div>
);

const ProductDetails = () => {
  const { productId, username: storeSlug } = useParams<{ productId: string; username?: string }>();
  const navigate = useNavigate();
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
    setProduct(null);
    setProductLoadStatus("loading");
  }, [productId, storeSlug]);

  const cachedTenantProduct = null;

  const handleProductLoaded = useCallback((p: Product | null, status: ProductLoadStatus) => {
    setProductLoadStatus(status);
    if (status === "success" && p) setProduct(p);
    if (status === "not_found" || status === "error") setProduct(null);
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

  if (productLoadStatus === "not_found" || productLoadStatus === "error") {
    const storeHome = getStoreHomePath(isTenantMode ? storeSlug : null);
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 mb-4 rounded-full bg-muted flex items-center justify-center text-3xl">📦</div>
        <h1 className="text-lg font-bold text-foreground mb-2">
          {productLoadStatus === "error" ? "تعذر تحميل المنتج" : "المنتج غير موجود"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {productLoadStatus === "error"
            ? "تحقق من الاتصال وحاول مرة أخرى"
            : "ربما تم حذف المنتج أو أن الرابط غير صحيح"}
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
          initialProduct={cachedTenantProduct}
          onProductLoaded={handleProductLoaded}
        />
        <ProductDetailsSkeleton />
      </>
    );
  }

  const allImages = product.additionalImages ? [product.image, ...product.additionalImages] : [product.image];

  return (
    <StoreThemeProvider colors={themeColors}>
    <div className="min-h-screen bg-background pb-28">
      <MarketingScripts
        storeSlug={isTenantMode ? storeSlug : undefined}
        storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id}
        disabled={!isTenantMode}
      />
      <ProductHeader productId={product.id} productName={product.name} storeSlug={storeSlug} />

      <div className="max-w-lg mx-auto">
        <div className="px-4 pt-4">
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
        </div>

        <div className="p-4 space-y-5">
          {/* Title, price, availability */}
          <ScrollReveal delay={0}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-left shrink-0">
                  {hasDiscount && product.originalPrice ? (
                    <div className="flex flex-col items-start">
                      <span className="text-sm text-muted-foreground line-through">{product.originalPrice.toLocaleString()} د.ع</span>
                      <span className="text-2xl font-bold text-destructive">{product.price.toLocaleString()} د.ع</span>
                      {discountPercent && (
                        <span className="inline-block bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-lg font-bold mt-1">
                          وفّر {discountPercent}%
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-2xl font-bold text-foreground">{product.price.toLocaleString()} د.ع</span>
                  )}
                </div>
                <div className="text-right flex-1">
                  <h1 className="text-xl font-bold text-foreground leading-snug">{product.name}</h1>
                  {product.category && (
                    <p className="text-xs text-muted-foreground mt-1">{product.category}</p>
                  )}
                </div>
              </div>

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
            </div>
          </ScrollReveal>

          {/* Size Selection */}
          {product.sizes && product.sizes.length > 0 && (
            <ScrollReveal delay={100}>
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-foreground text-right">المقاس</h3>
                <div className="flex flex-wrap gap-2 justify-end">
                  {product.sizes.map((size, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedSize(selectedSize === size ? "" : size)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                        selectedSize === size
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105'
                          : 'bg-card text-foreground border-border hover:border-primary/30 hover:scale-[1.02]'
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

          {/* Color Selection */}
          {product.colors && product.colors.length > 0 && (
            <ScrollReveal delay={150}>
              <div className="space-y-2.5">
                <div className="flex items-center justify-end gap-2">
                  {selectedColor && (
                    <span className="text-xs text-muted-foreground">
                      {product.colors.find(c => c.value === selectedColor)?.name || 'محدد'}
                    </span>
                  )}
                  <h3 className="text-sm font-semibold text-foreground">اللون</h3>
                </div>
                <div className="flex flex-wrap gap-2.5 justify-end">
                  {product.colors.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedColor(selectedColor === color.value ? "" : color.value)}
                      className={`w-12 h-12 rounded-xl border-2 transition-all duration-200 relative overflow-hidden ${
                        selectedColor === color.value
                          ? 'border-primary ring-2 ring-primary/20 scale-110'
                          : 'border-border hover:border-primary/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
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

          {/* Quantity — desktop inline actions hidden on mobile (sticky bar handles mobile) */}
          <ScrollReveal delay={200}>
            <div className="space-y-3 hidden sm:block">
              <div className="flex items-center justify-between">
                <ProductQuantity
                  quantity={quantity}
                  onIncrement={() => setQuantity((prev) => Math.min(prev + 1, Math.max(variantAvailable, 1)))}
                  onDecrement={() => setQuantity((prev) => Math.max(1, prev - 1))}
                />
                <h3 className="text-sm font-semibold text-foreground">الكمية</h3>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAdding || isOutOfStock}
                  className="flex-1 h-12 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 disabled:opacity-50"
                >
                  أضف للسلة
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={isAdding || isOutOfStock}
                  className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50"
                >
                  اشتري الآن
                </button>
              </div>
            </div>
            <div className="sm:hidden">
              <div className="flex items-center justify-between mb-3">
                <ProductQuantity
                  quantity={quantity}
                  onIncrement={() => setQuantity((prev) => Math.min(prev + 1, Math.max(variantAvailable, 1)))}
                  onDecrement={() => setQuantity((prev) => Math.max(1, prev - 1))}
                />
                <h3 className="text-sm font-semibold text-foreground">الكمية</h3>
              </div>
            </div>
          </ScrollReveal>

          {/* Trust */}
          <ScrollReveal delay={250} animation="slide-up">
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Truck className="w-5 h-5" />, label: "توصيل سريع" },
                { icon: <Shield className="w-5 h-5" />, label: "دفع آمن" },
                { icon: <RotateCcw className="w-5 h-5" />, label: returnPolicy ? "إرجاع متاح" : "ضمان الجودة" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 py-3 bg-muted/50 rounded-xl border border-border/40">
                  <span className="text-primary">{item.icon}</span>
                  <span className="text-[11px] font-medium text-muted-foreground text-center">{item.label}</span>
                </div>
              ))}
            </div>
            {isTenantMode && (
              <p className="text-[10px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                <BadgeCheck className="w-3 h-3 text-primary" />
                متجر موثوق — الدفع عند الاستلام متاح
              </p>
            )}
          </ScrollReveal>

          {returnPolicy && (
            <ScrollReveal delay={280}>
              <ExpandableSection title="سياسة الإرجاع والشحن" defaultOpen={false}>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{returnPolicy}</p>
              </ExpandableSection>
            </ScrollReveal>
          )}

          {/* Description */}
          <ScrollReveal delay={300}>
            <div className="border-t border-border/50 pt-4">
              <ExpandableSection title="الوصف" defaultOpen>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-muted-foreground leading-relaxed text-sm">{product.description}</p>
                </div>
              </ExpandableSection>
            </div>
          </ScrollReveal>

          {/* Rating Section */}
          <ScrollReveal delay={350}>
            <RatingSection productId={productId || ""} storeSlug={storeSlug} />
          </ScrollReveal>

          {/* Suggested Products */}
          <ScrollReveal delay={400}>
            <SuggestedProducts currentProductId={productId || ""} storeSlug={storeSlug} category={product.category} />
          </ScrollReveal>
        </div>

        <StorefrontFooter
          storeName={displayStoreName || 'المتجر'}
          storeSlug={storeSlug}
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
