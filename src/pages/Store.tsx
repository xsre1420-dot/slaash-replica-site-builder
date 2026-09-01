import { RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getCategories, getCategoriesSync } from "@/services/productService";
import { Product, Category } from "@/types";
import { useCartActions } from "@/context/CartContext";
import MarketingScripts from "@/components/MarketingScripts";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useStoreVisitTracking } from "@/hooks/useStoreVisitTracking";
import { useStoreProductsPage } from "@/hooks/useStoreProductsPage";
import { useMerchantProductsPage } from "@/hooks/useMerchantProductsPage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import WhatsAppButton from "@/components/WhatsAppButton";
import StoreProductGrid from "@/components/store/StoreProductGrid";
import { StoreFixedCheckoutBar } from "@/components/store/StoreCartChrome";
import StoreThemeProvider from "@/components/StoreThemeProvider";
import StoreCategoryChip from "@/components/store/StoreCategoryChip";
import { useToast } from "@/hooks/use-toast";
import { useStoreDisplay } from "@/hooks/useStoreDisplay";
import { STORE_PRODUCTS_PAGE_SIZE } from "@/constants/pagination";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import StorefrontHeader from "@/components/storefront/layout/StorefrontHeader";
import StorefrontHero from "@/components/storefront/layout/StorefrontHero";
import StorefrontBenefits from "@/components/storefront/layout/StorefrontBenefits";
import StorefrontToolbar from "@/components/storefront/layout/StorefrontToolbar";
import StorefrontNewsletter from "@/components/storefront/layout/StorefrontNewsletter";
import SEOHead from "@/components/seo/SEOHead";
import { getProductPath } from "@/lib/storefrontPaths";
import { persistCheckoutStoreSlug } from "@/lib/checkoutStoreContext";

const Store = () => {
  const { username: storeSlug } = useParams();
  const {
    isTenantMode,
    storeName,
    storeLogo,
    storeSettings,
    ownerId: displayOwnerId,
    loading: displayLoading,
    categories: tenantCategories,
    refetch: refetchTenantStore,
    returnPolicy,
    privacyPolicy,
  } = useStoreDisplay(storeSlug);
  useStoreVisitTracking(isTenantMode ? storeSlug : undefined, {
    storefrontReady: !displayLoading && !!displayOwnerId,
  });

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const tenantCategoryFilter = useMemo(() => {
    if (selectedCategory === 'all') return undefined;
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat?.name ?? undefined;
  }, [selectedCategory, categories]);

  const ownerCategoryFilter = useMemo(() => {
    if (selectedCategory === 'all') return 'all';
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat?.name ?? selectedCategory;
  }, [selectedCategory, categories]);

  const tenantProducts = useStoreProductsPage(storeSlug, {
    category: tenantCategoryFilter,
    search: debouncedSearch,
    enabled: isTenantMode,
  });

  const ownerCatalog = useMerchantProductsPage(debouncedSearch, ownerCategoryFilter, {
    enabled: !isTenantMode,
  });
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(STORE_PRODUCTS_PAGE_SIZE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterPriceRange, setFilterPriceRange] = useState<[number, number]>([0, 0]);
  const [filterSizes, setFilterSizes] = useState<string[]>([]);

  const { addToCart, setStoreOwner } = useCartActions();
  const { trackAddToCart, trackSearch } = useMetaPixel();
  const { toast } = useToast();
  const navigate = useNavigate();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const bannerDotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullStartY = useRef(0);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  // Derive display values from unified hook
  useEffect(() => {
    if (isTenantMode && displayOwnerId) {
      setStoreOwner(displayOwnerId);
      if (storeSlug) persistCheckoutStoreSlug(displayOwnerId, storeSlug);
    }
  }, [isTenantMode, displayOwnerId, storeSlug, setStoreOwner]);

  useEffect(() => {
    if (!isTenantMode || !debouncedSearch.trim()) return;
    trackSearch(debouncedSearch.trim());
  }, [debouncedSearch, isTenantMode, trackSearch]);

  const allProducts = useMemo(
    () => (isTenantMode ? tenantProducts.products : ownerCatalog.products),
    [isTenantMode, tenantProducts.products, ownerCatalog.products]
  );

  const catalogLoading = isTenantMode ? tenantProducts.loading : ownerCatalog.loading;

  useEffect(() => {
    setIsLoading(catalogLoading);
    setVisibleCount(STORE_PRODUCTS_PAGE_SIZE);
  }, [selectedCategory, catalogLoading]);

  const loadData = useCallback(async (force = false) => {
    if (isTenantMode) {
      if (force) {
        refetchTenantStore();
        tenantProducts.refetch();
      }
      return;
    }
    setIsLoading(true);
    try {
      const categoriesData = await getCategories(force);
      setCategories([{ id: "all", name: "الكل", order: -1 }, ...categoriesData]);
      if (force) await ownerCatalog.reload();
    } catch {
      setCategories([{ id: "all", name: "الكل", order: -1 }, ...getCategoriesSync()]);
    }
    setIsLoading(false);
  }, [isTenantMode, refetchTenantStore, tenantProducts, ownerCatalog]);

  useEffect(() => {
    if (isTenantMode && !displayLoading) {
      setCategories([{ id: "all", name: "الكل", order: -1 }, ...tenantCategories]);
    }
  }, [isTenantMode, displayLoading, tenantCategories]);

  useEffect(() => { if (!isTenantMode) loadData(); }, [loadData, isTenantMode]);

  const bannerImages = storeSettings.bannerImages || [];
  useEffect(() => {
    if (bannerImages.length <= 1) return;
    let transitionTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      transitionTimer = setTimeout(() => {
        setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length);
        setIsTransitioning(false);
        transitionTimer = null;
      }, 200);
    }, 3500);
    return () => {
      clearInterval(interval);
      if (transitionTimer) clearTimeout(transitionTimer);
      if (bannerDotTimerRef.current) clearTimeout(bannerDotTimerRef.current);
    };
  }, [bannerImages.length]);

  // --- Compute max price and available sizes ---
  const maxPrice = useMemo(() => Math.max(...allProducts.map(p => p.price), 100000), [allProducts]);
  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    allProducts.forEach(p => p.sizes?.forEach(s => sizes.add(s)));
    return Array.from(sizes);
  }, [allProducts]);

  // Initialize filter range once maxPrice is known
  useEffect(() => {
    setFilterPriceRange((prev) => (prev[1] === 0 && maxPrice > 0 ? [0, maxPrice] : prev));
  }, [maxPrice]);

  // --- Filter, search, sort ---
  const displayProducts = useMemo(() => {
    let filtered = allProducts;
    if (!isTenantMode && searchQuery.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    // Price filter
    if (filterPriceRange[0] > 0 || (filterPriceRange[1] > 0 && filterPriceRange[1] < maxPrice)) {
      filtered = filtered.filter(p => p.price >= filterPriceRange[0] && p.price <= filterPriceRange[1]);
    }
    // Size filter
    if (filterSizes.length > 0) {
      filtered = filtered.filter(p => p.sizes?.some(s => filterSizes.includes(s)));
    }
    // Sort
    if (sortBy === "price-asc") filtered = [...filtered].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [allProducts, debouncedSearch, sortBy, filterPriceRange, filterSizes, maxPrice]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (isTenantMode && tenantProducts.hasMore) {
        tenantProducts.loadMore();
        return;
      }
      if (!isTenantMode && ownerCatalog.hasMore) {
        void ownerCatalog.loadMore();
        return;
      }
      if (visibleCount < displayProducts.length) {
        setVisibleCount((prev) => Math.min(prev + STORE_PRODUCTS_PAGE_SIZE, displayProducts.length));
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayProducts.length, visibleCount, isTenantMode, tenantProducts.hasMore, tenantProducts.loadMore, ownerCatalog.hasMore, ownerCatalog.loadMore]);

  // --- Pull to refresh ---
  const handleTouchStart = (e: React.TouchEvent) => { pullStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = async (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - pullStartY.current;
    if (diff > 100 && window.scrollY === 0) {
      setIsRefreshing(true);
      await loadData(true); // Force refresh
      setIsRefreshing(false);
    }
  };

  // --- Category swipe ---
  const handleCategoryTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleCategoryTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 60) {
      const currentIdx = categories.findIndex(c => c.id === selectedCategory);
      if (diff < 0 && currentIdx < categories.length - 1) setSelectedCategory(categories[currentIdx + 1].id);
      if (diff > 0 && currentIdx > 0) setSelectedCategory(categories[currentIdx - 1].id);
    }
  };

  const handleViewProduct = useCallback((productId: string) => {
    const previewProduct =
      displayProducts.find((p) => p.id === productId) ??
      allProducts.find((p) => p.id === productId);
    navigate(getProductPath(productId, isTenantMode ? storeSlug : null), {
      state: previewProduct ? { previewProduct } : undefined,
    });
  }, [isTenantMode, storeSlug, navigate, displayProducts, allProducts]);

  const handleAddToCart = useCallback((product: Product) => {
    const needsVariants = (product.sizes?.length ?? 0) > 0 || (product.colors?.length ?? 0) > 0;
    if (needsVariants) {
      toast({
        title: "اختر الخيارات أولاً",
        description: "يرجى اختيار المقاس أو اللون من صفحة المنتج",
      });
      handleViewProduct(product.id);
      return;
    }
    if (isTenantMode && displayOwnerId) {
      setStoreOwner(displayOwnerId);
    }
    addToCart(product);
    trackAddToCart(product.id, product.name, product.price);
    toast({
      title: "✅ تمت الإضافة",
      description: `${product.name} أُضيف إلى السلة`,
    });
  }, [isTenantMode, displayOwnerId, setStoreOwner, addToCart, trackAddToCart, toast, handleViewProduct]);

  const handleShare = useCallback(async (product: Product) => {
    const productUrl = isTenantMode ? `${window.location.origin}/store/${storeSlug}/product/${product.id}` : `${window.location.origin}/product-details/${product.id}`;
    const shareData = { title: product.name, text: `${product.name} - ${product.price.toLocaleString()} د.ع`, url: productUrl };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); toast({ title: "تم النسخ", description: "تم نسخ رابط المنتج" }); }
    } catch {}
  }, [isTenantMode, storeSlug, toast]);

  // --- Sort ---
  const cycleSortBy = () => setSortBy(prev => prev === "default" ? "price-asc" : prev === "price-asc" ? "price-desc" : "default");
  const sortLabel = sortBy === "price-asc" ? "الأقل سعراً" : sortBy === "price-desc" ? "الأعلى سعراً" : "ترتيب";

  // Active filter count
  const activeFilterCount = (filterPriceRange[0] > 0 || (filterPriceRange[1] > 0 && filterPriceRange[1] < maxPrice) ? 1 : 0) + (filterSizes.length > 0 ? 1 : 0);

  const themeColors = useMemo(
    () => ({
      backgroundColor: storeSettings.menuBackgroundColor,
      textColor: storeSettings.menuTextColor,
      accentColor: storeSettings.menuAccentColor,
      font: (storeSettings as any).storeFont || 'Tajawal',
    }),
    [
      storeSettings.menuBackgroundColor,
      storeSettings.menuTextColor,
      storeSettings.menuAccentColor,
      (storeSettings as any).storeFont,
    ]
  );

  const handleFilterApply = useCallback((range: [number, number], sizes: string[]) => {
    setFilterPriceRange(range);
    setFilterSizes(sizes);
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilterPriceRange([0, maxPrice]);
    setFilterSizes([]);
  }, [maxPrice]);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleBannerDotClick = useCallback((i: number) => {
    if (bannerDotTimerRef.current) clearTimeout(bannerDotTimerRef.current);
    setIsTransitioning(true);
    bannerDotTimerRef.current = setTimeout(() => {
      bannerDotTimerRef.current = null;
      setCurrentImageIndex(i);
      setIsTransitioning(false);
    }, 200);
  }, []);

  return (
    <>
      <SEOHead
        title={storeName ? `${storeName} — متجر إلكتروني` : 'المتجر'}
        description={storeName ? `تسوق من ${storeName} — منتجات متنوعة بأسعار منافسة` : 'متجر إلكتروني'}
        url={storeSlug ? `${window.location.origin}/store/${storeSlug}` : undefined}
        storeName={storeName}
      />
    <StoreThemeProvider colors={themeColors}>
    <div className="sf-page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <MarketingScripts
        storeSlug={isTenantMode ? storeSlug : undefined}
        storeOwnerId={isTenantMode ? displayOwnerId : undefined}
      />

      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-[60] flex justify-center py-3 bg-primary/10 backdrop-blur-sm">
          <RefreshCw className="w-5 h-5 text-primary animate-spin" />
        </div>
      )}

      <StorefrontHeader
        storeName={storeName || 'المتجر'}
        storeLogo={storeLogo}
        isVerified={isTenantMode}
        storeSlug={isTenantMode ? storeSlug : undefined}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        scrolled={headerScrolled}
      />

      <StorefrontHero
        storeName={storeName || 'المتجر'}
        bannerImages={bannerImages}
        currentIndex={currentImageIndex}
        isTransitioning={isTransitioning}
        onDotClick={handleBannerDotClick}
      />

      <StorefrontBenefits />

      <section className="sf-container pb-2">
        <p className="text-xs font-semibold text-muted-foreground mb-2 text-right px-1">الأقسام</p>
        <div
          ref={categoriesRef}
          onTouchStart={handleCategoryTouchStart}
          onTouchEnd={handleCategoryTouchEnd}
          className="overflow-x-auto scrollbar-hide -mx-1 px-1 pb-2"
        >
          <div className="flex gap-2 min-w-min">
            {categories.map((cat) => (
              <StoreCategoryChip
                key={cat.id}
                label={cat.name}
                active={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <StorefrontToolbar
        sortLabel={sortLabel}
        sortActive={sortBy !== 'default'}
        onCycleSort={cycleSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        maxPrice={maxPrice}
        filterPriceRange={filterPriceRange}
        availableSizes={availableSizes}
        filterSizes={filterSizes}
        onFilterApply={handleFilterApply}
        onFilterReset={handleFilterReset}
        activeFilterCount={activeFilterCount}
        productCount={displayProducts.length}
        sectionTitle={searchQuery ? `نتائج "${searchQuery}"` : 'تسوق الآن'}
      />

      <div className="sf-container pb-32 lg:pb-16 pt-1">
        <StoreProductGrid
          products={displayProducts}
          viewMode={viewMode}
          isLoading={isLoading}
          searchQuery={searchQuery}
          visibleCount={visibleCount}
          totalCount={displayProducts.length}
          isTenantMode={isTenantMode}
          storeSlug={storeSlug}
          onAddToCart={handleAddToCart}
          onShare={handleShare}
          sentinelRef={sentinelRef}
        />
      </div>

      <StorefrontNewsletter storeName={storeName || 'المتجر'} />

      <StorefrontFooter
        storeName={storeName || 'المتجر'}
        storeSlug={storeSlug}
        ownerId={displayOwnerId}
        whatsappNumber={storeSettings.whatsappNumber}
        returnPolicy={returnPolicy}
        privacyPolicy={privacyPolicy}
      />

      <WhatsAppButton phoneNumber={storeSettings.whatsappNumber || ""} />

      <StoreFixedCheckoutBar isTenantMode={isTenantMode} storeSlug={storeSlug} />
    </div>
    </StoreThemeProvider>
    </>
  );
};

export default Store;
