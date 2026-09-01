import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import MarketingScripts from "@/components/MarketingScripts";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useTenantStore } from "@/context/TenantStoreContext";
import { toast } from "sonner";
import StoreThemeProvider from "@/components/StoreThemeProvider";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { StoreFixedCheckoutBar } from "@/components/store/StoreCartChrome";
import ProductInfoPanel from "@/components/storefront/ProductInfoPanel";
import ProductDescriptionBlock from "@/components/storefront/ProductDescriptionBlock";
import ProductSpecifications from "@/components/product-details/ProductSpecifications";
import { getCheckoutPath, getStoreHomePath } from "@/lib/storefrontPaths";
import { resolveStoreOwnerBySlug } from "@/services/storefrontProductService";
import {
  getAvailableQty,
  validateVariantSelection,
  applyActiveDiscount,
} from "@/utils/inventoryUtils";
import { getProductGalleryImages } from "@/lib/storefrontProductDisplay";
import ProductHeader from "@/components/product-details/ProductHeader";
import ProductImages from "@/components/product-details/ProductImages";
import { useProductDetailPageBundle } from "@/hooks/useProductDetailPageBundle";
import ExpandableSection from "@/components/product-details/ExpandableSection";
import RatingSection from "@/components/product-details/RatingSection";
import SuggestedProducts from "@/components/product-details/SuggestedProducts";
import ScrollReveal from "@/components/product-details/ScrollReveal";
import { useStoreVisitTracking } from "@/hooks/useStoreVisitTracking";
import { useProductViewTracking } from "@/hooks/useProductViewTracking";
import StoreEmptyState from '@/components/store/StoreEmptyState';
import { PackageX } from 'lucide-react';

const ProductDetailsSkeleton = () => (
  <div className="sf-page pb-28 lg:pb-16">
    <ProductHeader />
    <div className="sf-container py-6 lg:py-10">
      <div className="grid lg:grid-cols-2 xl:grid-cols-[1.08fr_0.92fr] gap-8 xl:gap-12">
        <div className="aspect-[4/5] sm:aspect-square lg:aspect-[4/5] sf-skeleton rounded-2xl" />
        <div className="space-y-5">
          <div className="h-4 sf-skeleton w-1/3 mr-auto rounded-md" />
          <div className="h-8 sf-skeleton w-full rounded-lg" />
          <div className="h-10 sf-skeleton w-2/3 mr-auto rounded-lg" />
          <div className="h-6 sf-skeleton w-1/2 mr-auto rounded-md" />
          <div className="h-24 sf-skeleton w-full rounded-xl" />
          <div className="h-12 sf-skeleton w-full rounded-xl" />
          <div className="h-12 sf-skeleton w-full rounded-xl" />
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
  const initialProduct = previewProduct?.id === productId ? previewProduct : null;
  const isTenantMode = !!storeSlug;
  const tenant = useTenantStore(storeSlug);
  const { user } = useAuth();
  const { trackViewContent, trackAddToCart } = useMetaPixel();
  const viewTrackedRef = useRef<string | null>(null);
  const checkoutPath = getCheckoutPath(isTenantMode ? storeSlug : null);

  const {
    status: productLoadStatus,
    product,
    reviews: bundleReviews,
    suggestedProducts: bundleSuggested,
    refetch: refetchDetailBundle,
  } = useProductDetailPageBundle({
    productId,
    storeSlug: isTenantMode ? storeSlug : undefined,
    ownerId: !isTenantMode ? user?.id : undefined,
    initialProduct,
  });

  useStoreVisitTracking(isTenantMode ? storeSlug : undefined, {
    storefrontReady: !tenant.loading && !!tenant.storeInfo,
  });
  useProductViewTracking(isTenantMode ? storeSlug : undefined, productId, {
    storefrontReady: !tenant.loading && !!tenant.storeInfo,
  });

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { addToCart, setStoreOwner } = useCart();
  const { storeSettings, storeName, storeGovernorate } = useStore();

  const themeColors = {
    backgroundColor: isTenantMode ? tenant.storeInfo?.menuBackgroundColor || "#ffffff" : storeSettings.menuBackgroundColor,
    textColor: isTenantMode ? tenant.storeInfo?.menuTextColor || "#333333" : storeSettings.menuTextColor,
    accentColor: isTenantMode ? tenant.storeInfo?.menuAccentColor || "#6366f1" : storeSettings.menuAccentColor,
    font: isTenantMode ? tenant.storeInfo?.storeFont || "Tajawal" : storeSettings.storeFont,
  };

  const displayStoreName = isTenantMode ? tenant.storeInfo?.storeName || storeName : storeName;
  const returnPolicy = isTenantMode ? tenant.storeInfo?.returnPolicy : "";
  const privacyPolicy = isTenantMode ? tenant.storeInfo?.privacyPolicy : "";
  const whatsappNumber = isTenantMode ? tenant.storeInfo?.whatsappNumber : "";

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

  const activeProduct = product ? applyActiveDiscount(product) : null;

  useEffect(() => {
    if (!activeProduct) return;
    if (viewTrackedRef.current === activeProduct.id) return;
    viewTrackedRef.current = activeProduct.id;
    trackViewContent(activeProduct.id, activeProduct.name, activeProduct.price);
  }, [activeProduct, trackViewContent]);

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
  const handleBuyNow = () => { if (tryAddToCart()) navigate(checkoutPath); };

  const isNew = product && (product as { created_at?: string }).created_at
    ? Date.now() - new Date((product as { created_at: string }).created_at).getTime() < 7 * 86400000
    : false;
  const isLowStock = activeProduct ? variantAvailable > 0 && variantAvailable <= 3 : false;
  const isOutOfStock = activeProduct ? variantAvailable <= 0 : false;

  const galleryImages = useMemo(
    () => (product ? getProductGalleryImages(product, selectedColor || undefined) : []),
    [product, selectedColor]
  );

  useEffect(() => {
    setQuantity(1);
    if (!activeProduct || !selectedSize) return;
    if (getAvailableQty(activeProduct, selectedSize, selectedColor || undefined) <= 0) {
      setSelectedSize("");
    }
  }, [selectedColor, selectedSize, activeProduct]);

  const handleReviewsChanged = useCallback(() => {
    void refetchDetailBundle();
  }, [refetchDetailBundle]);

  if (productLoadStatus === "not_found") {
    const storeHome = getStoreHomePath(isTenantMode ? storeSlug : null);
    return (
      <div className="sf-page min-h-[70vh] flex items-center justify-center p-6">
        <StoreEmptyState
          icon={<PackageX className="w-8 h-8" strokeWidth={1.75} />}
          title="المنتج غير موجود"
          description="ربما تم حذف المنتج أو أن الرابط غير صحيح"
          action={
            <button type="button" onClick={() => navigate(storeHome)} className="sf-btn-primary px-8 h-11">
              العودة للمتجر
            </button>
          }
        />
      </div>
    );
  }

  if (!product || !activeProduct) {
    return (
      <>
        <MarketingScripts storeSlug={isTenantMode ? storeSlug : undefined} storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id} disabled={!isTenantMode} />
        <ProductDetailsSkeleton />
      </>
    );
  }

  return (
    <StoreThemeProvider colors={themeColors}>
      <div className="sf-page pb-28 lg:pb-16">
        <MarketingScripts storeSlug={isTenantMode ? storeSlug : undefined} storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id} disabled={!isTenantMode} />
        <ProductHeader />

        <div className="sf-container py-5 lg:py-9">
          <div className="grid lg:grid-cols-2 xl:grid-cols-[1.08fr_0.92fr] gap-6 lg:gap-10 xl:gap-14 items-start">
            <ScrollReveal delay={0} className="lg:sticky lg:top-24 lg:self-start">
              <ProductImages
                key={`${selectedColor || "default"}-${galleryImages.join("|")}`}
                images={galleryImages}
                productName={product.name}
                tags={product.tags}
                galleryKey={selectedColor || "default"}
                isLarge
                isNew={isNew}
                isLowStock={isLowStock}
                stockQuantity={variantAvailable}
                isOutOfStock={isOutOfStock}
              />
            </ScrollReveal>

            <ScrollReveal delay={80} className="lg:sticky lg:top-24 lg:self-start">
              <ProductInfoPanel
                product={product}
                displayProduct={activeProduct}
                variantAvailable={variantAvailable}
                isOutOfStock={isOutOfStock}
                isLowStock={isLowStock}
                isNew={isNew}
                selectedSize={selectedSize}
                selectedColor={selectedColor}
                quantity={quantity}
                isAdding={isAdding}
                returnPolicy={returnPolicy}
                isTenantMode={isTenantMode}
                storeSlug={storeSlug}
                onSelectSize={setSelectedSize}
                onSelectColor={setSelectedColor}
                onIncrementQty={() => setQuantity((p) => Math.min(p + 1, Math.max(variantAvailable, 1)))}
                onDecrementQty={() => setQuantity((p) => Math.max(1, p - 1))}
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
              />
            </ScrollReveal>
          </div>

          <div className="mt-12 lg:mt-16 space-y-10 lg:space-y-12 max-w-3xl mr-auto ml-0">
            <ScrollReveal delay={120}>
              <ProductSpecifications product={product} />
            </ScrollReveal>

            <ScrollReveal delay={160}>
              <ProductDescriptionBlock product={product} />
            </ScrollReveal>

            {returnPolicy && (
              <ScrollReveal delay={200}>
                <ExpandableSection title="سياسة الإرجاع والشحن" defaultOpen={false}>
                  <p className="text-sm text-muted-foreground leading-[1.8] whitespace-pre-wrap">{returnPolicy}</p>
                </ExpandableSection>
              </ScrollReveal>
            )}

            <ScrollReveal delay={240}>
              <div id="product-reviews">
                <RatingSection
                  productId={productId || ""}
                  storeSlug={storeSlug}
                  prefetchedReviews={bundleReviews}
                  onReviewsChanged={handleReviewsChanged}
                />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={280}>
              <SuggestedProducts
                currentProductId={productId || ""}
                storeSlug={storeSlug}
                category={product.category}
                prefetchedProducts={bundleSuggested}
              />
            </ScrollReveal>
          </div>

          <StorefrontFooter
            storeName={displayStoreName || "المتجر"}
            storeSlug={storeSlug}
            ownerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id}
            governorate={storeGovernorate}
            whatsappNumber={whatsappNumber}
            returnPolicy={returnPolicy}
            privacyPolicy={privacyPolicy}
            fullWidth
          />
        </div>

        <StoreFixedCheckoutBar isTenantMode={isTenantMode} storeSlug={storeSlug} />
      </div>
    </StoreThemeProvider>
  );
};

export default ProductDetails;
