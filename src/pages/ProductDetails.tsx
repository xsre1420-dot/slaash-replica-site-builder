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
import ProductData, { type ProductLoadStatus } from "@/components/product-details/ProductData";
import ExpandableSection from "@/components/product-details/ExpandableSection";
import RatingSection from "@/components/product-details/RatingSection";
import SuggestedProducts from "@/components/product-details/SuggestedProducts";
import ScrollReveal from "@/components/product-details/ScrollReveal";
import { useStoreVisitTracking } from "@/hooks/useStoreVisitTracking";
import { useProductViewTracking } from "@/hooks/useProductViewTracking";

const ProductDetailsSkeleton = () => (
  <div className="sf-page">
    <ProductHeader />
    <div className="sf-container py-8 lg:py-12">
      <div className="grid lg:grid-cols-2 gap-10 xl:gap-16">
        <div className="aspect-[4/5] sf-skeleton rounded-3xl" />
        <div className="space-y-6">
          <div className="h-6 sf-skeleton w-1/3 mr-auto rounded-lg" />
          <div className="h-10 sf-skeleton w-full rounded-xl" />
          <div className="h-16 sf-skeleton w-2/3 mr-auto rounded-2xl" />
          <div className="h-32 sf-skeleton w-full rounded-2xl" />
          <div className="h-14 sf-skeleton w-full rounded-2xl" />
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
  useStoreVisitTracking(isTenantMode ? storeSlug : undefined);
  useProductViewTracking(isTenantMode ? storeSlug : undefined, productId);
  const [product, setProduct] = useState<Product | null>(null);
  const [productLoadStatus, setProductLoadStatus] = useState<ProductLoadStatus>("loading");
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

  useEffect(() => {
    if (initialProduct?.id === productId) {
      setProduct(initialProduct);
    } else {
      setProduct(null);
    }
    setProductLoadStatus("loading");
  }, [productId, storeSlug, initialProduct]);

  const handleProductLoaded = useCallback((p: Product | null, status: ProductLoadStatus) => {
    setProductLoadStatus(status);
    if (status === "success" && p) setProduct(p);
    if (status === "not_found") setProduct(null);
  }, []);

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

  if (productLoadStatus === "not_found") {
    const storeHome = getStoreHomePath(isTenantMode ? storeSlug : null);
    return (
      <div className="sf-page flex flex-col items-center justify-center p-8 text-center min-h-[70vh]">
        <div className="w-24 h-24 mb-6 rounded-3xl bg-muted/50 flex items-center justify-center text-4xl">📦</div>
        <h1 className="text-xl font-bold text-foreground mb-2">المنتج غير موجود</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm">ربما تم حذف المنتج أو أن الرابط غير صحيح</p>
        <button type="button" onClick={() => navigate(storeHome)} className="sf-btn-primary px-8">
          العودة للمتجر
        </button>
      </div>
    );
  }

  const productDataLoader = (
    <ProductData productId={productId} initialProduct={initialProduct} onProductLoaded={handleProductLoaded} />
  );

  if (!product || !activeProduct) {
    return (
      <>
        <MarketingScripts storeSlug={isTenantMode ? storeSlug : undefined} storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id} disabled={!isTenantMode} />
        {productDataLoader}
        <ProductDetailsSkeleton />
      </>
    );
  }

  return (
    <StoreThemeProvider colors={themeColors}>
      {productDataLoader}
      <div className="sf-page pb-28 lg:pb-16">
        <MarketingScripts storeSlug={isTenantMode ? storeSlug : undefined} storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id} disabled={!isTenantMode} />
        <ProductHeader />

        <div className="sf-container py-6 lg:py-10">
          <div className="grid lg:grid-cols-2 xl:grid-cols-[1.08fr_0.92fr] gap-8 xl:gap-16 items-start">
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

          <div className="mt-16 lg:mt-24 space-y-8 lg:space-y-12 max-w-4xl mr-auto ml-0">
            <ScrollReveal delay={120}>
              <ProductSpecifications product={product} />
            </ScrollReveal>

            <ScrollReveal delay={160}>
              <ProductDescriptionBlock product={product} />
            </ScrollReveal>

            {returnPolicy && (
              <ScrollReveal delay={200}>
                <ExpandableSection title="سياسة الإرجاع والشحن" defaultOpen={false}>
                  <p className="text-sm text-muted-foreground leading-[1.85] whitespace-pre-wrap">{returnPolicy}</p>
                </ExpandableSection>
              </ScrollReveal>
            )}

            <ScrollReveal delay={240}>
              <div id="product-reviews">
                <RatingSection productId={productId || ""} storeSlug={storeSlug} />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={280}>
              <SuggestedProducts currentProductId={productId || ""} storeSlug={storeSlug} category={product.category} />
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
