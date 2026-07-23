import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, Plus, PackageSearch } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getCategories, getCategoriesSync } from "@/services/productService";
import { useStoreHydration } from "@/context/StoreBootstrapContext";
import { useMerchantProductsPage } from "@/hooks/useMerchantProductsPage";
import { getProductLifecycleStatus } from "@/lib/productLifecycle";
import { STOREFRONT_PRODUCTS_CHANGED, resolveStoreSlugByOwnerId } from "@/services/storefrontProductService";
import { Product, Category } from "@/types";
import { useCartActions } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import MarketingScripts from "@/components/MarketingScripts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import StoreThemeProvider from "@/components/StoreThemeProvider";
import StoreProductGrid from "@/components/store/StoreProductGrid";
import StoreEmptyState from "@/components/store/StoreEmptyState";
import { StoreCartHeaderButton, StoreFixedCheckoutBar } from "@/components/store/StoreCartChrome";
import StoreCategoryChip from "@/components/store/StoreCategoryChip";
import StorefrontHeader from "@/components/storefront/layout/StorefrontHeader";
import StorefrontHero from "@/components/storefront/layout/StorefrontHero";
import StorefrontBenefits from "@/components/storefront/layout/StorefrontBenefits";
import StorefrontToolbar from "@/components/storefront/layout/StorefrontToolbar";
import StorefrontNewsletter from "@/components/storefront/layout/StorefrontNewsletter";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import WhatsAppButton from "@/components/WhatsAppButton";
import { useToast } from "@/hooks/use-toast";
import { STORE_PRODUCTS_PAGE_SIZE } from "@/constants/pagination";
import { getProductPath } from "@/lib/storefrontPaths";
import { useStoreVisitTracking } from "@/hooks/useStoreVisitTracking";

const PreviewStore = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const { addToCart, setStoreOwner } = useCartActions();
  const { storeName, storeLogo, storeSettings } = useStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(STORE_PRODUCTS_PAGE_SIZE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterPriceRange, setFilterPriceRange] = useState<[number, number]>([0, 0]);
  const [filterSizes, setFilterSizes] = useState<string[]>([]);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [publicStoreSlug, setPublicStoreSlug] = useState<string | undefined>();

  useEffect(() => {
    if (!user?.id) {
      setPublicStoreSlug(undefined);
      return;
    }
    void resolveStoreSlugByOwnerId(user.id).then((slug) => {
      setPublicStoreSlug(slug ?? undefined);
    });
  }, [user?.id]);

  useStoreVisitTracking(publicStoreSlug);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const bannerDotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullStartY = useRef(0);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const ownerCategoryFilter = useMemo(() => {
    if (selectedCategory === "all") return "all";
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat?.name ?? selectedCategory;
  }, [selectedCategory, categories]);

  const catalog = useMerchantProductsPage(debouncedSearch, ownerCategoryFilter);

  const allProducts = useMemo(
    () => catalog.products.filter((p) => getProductLifecycleStatus(p) === "published"),
    [catalog.products]
  );

  useEffect(() => {
    setIsLoading(catalog.loading);
    setVisibleCount(STORE_PRODUCTS_PAGE_SIZE);
  }, [selectedCategory, catalog.loading]);

  useEffect(() => {
    if (!user?.id) return;
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ ownerId?: string }>).detail;
      if (detail?.ownerId && detail.ownerId !== user.id) return;
      void catalog.reload();
    };
    window.addEventListener(STOREFRONT_PRODUCTS_CHANGED, onChanged);
    return () => window.removeEventListener(STOREFRONT_PRODUCTS_CHANGED, onChanged);
  }, [user?.id, catalog.reload]);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    void catalog.reload();
  }, [isReady, user?.id, catalog.reload]);

  useEffect(() => {
    if (user?.id) setStoreOwner(user.id);
  }, [user?.id, setStoreOwner]);

  const loadCategories = useCallback(async (force = false) => {
    try {
      const categoriesData = await getCategories(force);
      setCategories([{ id: "all", name: "الكل", order: -1 }, ...categoriesData]);
    } catch {
      setCategories([{ id: "all", name: "الكل", order: -1 }, ...getCategoriesSync()]);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void loadCategories(true);
  }, [isReady, hydrationVersion, loadCategories]);

  const loadData = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      await loadCategories(force);
      if (force) await catalog.reload();
    } finally {
      setIsLoading(false);
    }
  }, [loadCategories, catalog]);

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

  const maxPrice = useMemo(() => Math.max(...allProducts.map((p) => p.price), 100000), [allProducts]);
  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    allProducts.forEach((p) => p.sizes?.forEach((s) => sizes.add(s)));
    return Array.from(sizes);
  }, [allProducts]);

  useEffect(() => {
    setFilterPriceRange((prev) => (prev[1] === 0 && maxPrice > 0 ? [0, maxPrice] : prev));
  }, [maxPrice]);

  const displayProducts = useMemo(() => {
    let filtered = allProducts;
    if (searchQuery.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    if (filterPriceRange[0] > 0 || (filterPriceRange[1] > 0 && filterPriceRange[1] < maxPrice)) {
      filtered = filtered.filter(
        (p) => p.price >= filterPriceRange[0] && p.price <= filterPriceRange[1]
      );
    }
    if (filterSizes.length > 0) {
      filtered = filtered.filter((p) => p.sizes?.some((s) => filterSizes.includes(s)));
    }
    if (sortBy === "price-asc") filtered = [...filtered].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [allProducts, debouncedSearch, searchQuery, sortBy, filterPriceRange, filterSizes, maxPrice]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (catalog.hasMore) {
        void catalog.loadMore();
        return;
      }
      if (visibleCount < displayProducts.length) {
        setVisibleCount((prev) =>
          Math.min(prev + STORE_PRODUCTS_PAGE_SIZE, displayProducts.length)
        );
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayProducts.length, visibleCount, catalog.hasMore, catalog.loadMore]);

  const handleTouchStart = (e: React.TouchEvent) => {
    pullStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = async (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - pullStartY.current;
    if (diff > 100 && window.scrollY === 0) {
      setIsRefreshing(true);
      await loadData(true);
      setIsRefreshing(false);
    }
  };

  const handleCategoryTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleCategoryTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 60) {
      const currentIdx = categories.findIndex((c) => c.id === selectedCategory);
      if (diff < 0 && currentIdx < categories.length - 1) {
        setSelectedCategory(categories[currentIdx + 1].id);
      }
      if (diff > 0 && currentIdx > 0) {
        setSelectedCategory(categories[currentIdx - 1].id);
      }
    }
  };

  const handleViewProduct = useCallback(
    (productId: string) => {
      const previewProduct =
        displayProducts.find((p) => p.id === productId) ??
        allProducts.find((p) => p.id === productId);
      navigate(getProductPath(productId, publicStoreSlug ?? null), {
        state: previewProduct ? { previewProduct } : undefined,
      });
    },
    [navigate, displayProducts, allProducts, publicStoreSlug]
  );

  const handleAddToCart = useCallback(
    (product: Product) => {
      const needsVariants = (product.sizes?.length ?? 0) > 0 || (product.colors?.length ?? 0) > 0;
      if (needsVariants) {
        toast({
          title: "اختر الخيارات أولاً",
          description: "يرجى اختيار المقاس أو اللون من صفحة المنتج",
        });
        handleViewProduct(product.id);
        return;
      }
      addToCart(product);
      toast({
        title: "✅ تمت الإضافة",
        description: `${product.name} أُضيف إلى السلة`,
      });
    },
    [addToCart, toast, handleViewProduct]
  );

  const handleShare = useCallback(
    async (product: Product) => {
      const productUrl = publicStoreSlug
        ? `${window.location.origin}${getProductPath(product.id, publicStoreSlug)}`
        : `${window.location.origin}/product-details/${product.id}`;
      try {
        if (navigator.share) {
          await navigator.share({
            title: product.name,
            text: `${product.name} - ${product.price.toLocaleString()} د.ع`,
            url: productUrl,
          });
        } else {
          await navigator.clipboard.writeText(productUrl);
          toast({ title: "تم النسخ", description: "تم نسخ رابط المنتج" });
        }
      } catch {
        /* cancelled */
      }
    },
    [toast, publicStoreSlug]
  );

  const cycleSortBy = () =>
    setSortBy((prev) =>
      prev === "default" ? "price-asc" : prev === "price-asc" ? "price-desc" : "default"
    );
  const sortLabel =
    sortBy === "price-asc" ? "الأقل سعراً" : sortBy === "price-desc" ? "الأعلى سعراً" : "ترتيب";
  const activeFilterCount =
    (filterPriceRange[0] > 0 ||
    (filterPriceRange[1] > 0 && filterPriceRange[1] < maxPrice)
      ? 1
      : 0) + (filterSizes.length > 0 ? 1 : 0);

  const themeColors = useMemo(
    () => ({
      backgroundColor: storeSettings.menuBackgroundColor,
      textColor: storeSettings.menuTextColor,
      accentColor: storeSettings.menuAccentColor,
      font: storeSettings.storeFont || "Tajawal",
    }),
    [
      storeSettings.menuBackgroundColor,
      storeSettings.menuTextColor,
      storeSettings.menuAccentColor,
      storeSettings.storeFont,
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const showOwnerEmpty = !isLoading && displayProducts.length === 0 && !searchQuery.trim();

  return (
    <StoreThemeProvider colors={themeColors}>
      <div className="sf-page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <MarketingScripts storeOwnerId={user?.id} disabled />

        {isRefreshing && (
          <div className="fixed top-0 left-0 right-0 z-[60] flex justify-center py-3 bg-primary/10 backdrop-blur-sm">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}

        <div className="bg-primary/10 border-b border-primary/15 text-center py-2 px-4 text-xs font-medium text-primary">
          معاينة المتجر — هكذا يراه عملاؤك
        </div>

        <StorefrontHeader
          storeName={storeName || "المتجر"}
          storeLogo={storeLogo}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          scrolled={headerScrolled}
          startAction={
            user?.id ? (
              <Link to="/builder" aria-label="العودة للوحة التحكم" className="sf-icon-btn">
                <ArrowRight className="w-5 h-5" strokeWidth={2} />
              </Link>
            ) : (
              <div className="w-11 shrink-0" aria-hidden />
            )
          }
          endAction={<StoreCartHeaderButton />}
        />

        <StorefrontHero
          storeName={storeName || "المتجر"}
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
          sortActive={sortBy !== "default"}
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
          sectionTitle={searchQuery ? `نتائج "${searchQuery}"` : "تسوق الآن"}
        />

        <div className="sf-container pb-32 lg:pb-16 pt-1">
          {showOwnerEmpty ? (
            <StoreEmptyState
              icon={<PackageSearch className="w-8 h-8" strokeWidth={1.75} />}
              title="لا توجد منتجات بعد"
              description="ابدأ بإضافة منتجاتك من لوحة التحكم ليراها عملاؤك في متجرك"
              action={
                <Link to="/add-product">
                  <Button className="sf-btn-primary rounded-xl px-8 h-11">
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة أول منتج
                  </Button>
                </Link>
              }
            />
          ) : (
            <StoreProductGrid
              products={displayProducts}
              viewMode={viewMode}
              isLoading={isLoading || !isReady}
              searchQuery={searchQuery}
              visibleCount={visibleCount}
              totalCount={displayProducts.length}
              isTenantMode={false}
              storeSlug={publicStoreSlug}
              onAddToCart={handleAddToCart}
              onShare={handleShare}
              sentinelRef={sentinelRef}
            />
          )}
        </div>

        <StorefrontNewsletter storeName={storeName || "المتجر"} />

        <StorefrontFooter storeName={storeName || "المتجر"} whatsappNumber={storeSettings.whatsappNumber} />

        <WhatsAppButton phoneNumber={storeSettings.whatsappNumber || ""} />

        <StoreFixedCheckoutBar isTenantMode={false} />
      </div>
    </StoreThemeProvider>
  );
};

export default PreviewStore;
