import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import MarketingScripts from "@/components/MarketingScripts";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useTenantStore } from "@/context/TenantStoreContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import StoreThemeProvider from "@/components/StoreThemeProvider";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { StoreFixedCheckoutBar } from "@/components/store/StoreCartChrome";
import ProductInfoPanel from "@/components/storefront/ProductInfoPanel";
import ProductDescriptionBlock from "@/components/storefront/ProductDescriptionBlock";
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
  <div className="min-h-screen bg-background">
    <div className="h-14 border-b border-border/40 bg-card/80" />
    <div className="max-w-6xl mx-auto">
      <Skeleton className="aspect-[4/3] max-h-[360px] w-full rounded-none lg:rounded-2xl lg:m-6" />
      <div className="p-4 space-y-4 -mt-4 rounded-t-3xl bg-card border-t border-border/50">
        <Skeleton className="h-8 w-3/4 ms-auto" />
        <Skeleton className="h-10 w-1/2 ms-auto" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 mb-4 rounded-full bg-muted flex items-center justify-center text-3xl">📦</div>
        <h1 className="text-lg font-bold text-foreground mb-2">المنتج غير موجود</h1>
        <p className="text-sm text-muted-foreground mb-6">ربما تم حذف المنتج أو أن الرابط غير صحيح</p>
        <button type="button" onClick={() => navigate(storeHome)} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium">
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
      <div className="min-h-screen bg-background pb-28 lg:pb-12">
        <MarketingScripts storeSlug={isTenantMode ? storeSlug : undefined} storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id} disabled={!isTenantMode} />
        <ProductHeader />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lg:pt-6">
          {/* Desktop: info left, gallery right (physical columns — grid lines ignore dir) */}
          <div className="grid lg:grid-cols-[minmax(360px,440px)_minmax(0,1.15fr)] lg:gap-10 xl:gap-14 lg:items-start">
            <ScrollReveal
              delay={0}
              className="order-1 lg:order-2 lg:col-start-2 pt-4 lg:pt-0 lg:sticky lg:top-[4.5rem] lg:self-start"
            >
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

            <div className="order-2 lg:order-1 lg:col-start-1 lg:row-start-1 pt-6 lg:pt-0 lg:sticky lg:top-[4.5rem] lg:self-start">
              <ScrollReveal delay={50}>
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
          </div>

          <div className="mt-12 lg:mt-16 space-y-10 lg:space-y-12 pb-8">
            {returnPolicy && (
              <ScrollReveal delay={200}>
                <ExpandableSection title="سياسة الإرجاع والشحن" defaultOpen={false}>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{returnPolicy}</p>
                </ExpandableSection>
              </ScrollReveal>
            )}

            <ScrollReveal delay={250}>
              <ProductDescriptionBlock product={product} />
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div id="product-reviews">
                <RatingSection productId={productId || ""} storeSlug={storeSlug} />
              </div>
            </ScrollReveal>

            <ScrollReveal delay={350}>
              <SuggestedProducts currentProductId={productId || ""} storeSlug={storeSlug} category={product.category} />
            </ScrollReveal>

            <StorefrontFooter
              storeName={displayStoreName || "المتجر"}
              storeSlug={storeSlug}
              ownerId={isTenantMode ? tenant.storeInfo?.ownerId : user?.id}
              governorate={storeGovernorate}
              whatsappNumber={whatsappNumber}
              returnPolicy={returnPolicy}
              privacyPolicy={privacyPolicy}
            />
          </div>
        </div>

        <StoreFixedCheckoutBar isTenantMode={isTenantMode} storeSlug={storeSlug} />
      </div>
    </StoreThemeProvider>
  );
};

export default ProductDetails;
