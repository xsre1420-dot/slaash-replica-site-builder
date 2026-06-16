import { X, ShoppingCart, Plus, Search, Heart, Star, SlidersHorizontal, ArrowUpDown, Grid3X3, List, Mic, MicOff, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getProductsByCategory, getCategories, loadProducts } from "@/services/productService";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import MarketingScripts from "@/components/MarketingScripts";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useStoreVisitTracking } from "@/hooks/useStoreVisitTracking";
import CartDrawer from "@/components/CartDrawer";
import { useTenantStore } from "@/hooks/useTenantStore";
import { useStoreProductsPage } from "@/hooks/useStoreProductsPage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import WhatsAppButton from "@/components/WhatsAppButton";
import ProductCard from "@/components/store/ProductCard";
import ProductSkeleton from "@/components/store/ProductSkeleton";
import FavoritesDrawer from "@/components/store/FavoritesDrawer";
import StoreFilterDrawer from "@/components/store/StoreFilterDrawer";
import StoreThemeProvider from "@/components/StoreThemeProvider";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/hooks/use-toast";
import { useStoreDisplay } from "@/hooks/useStoreDisplay";
import { STORE_PRODUCTS_PAGE_SIZE } from "@/constants/pagination";
import SEOHead from "@/components/seo/SEOHead";
import StorefrontTrustBar from "@/components/storefront/StorefrontTrustBar";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { getCheckoutPath, getProductPath } from "@/lib/storefrontPaths";
import { persistCheckoutStoreSlug } from "@/lib/checkoutStoreContext";
import { persistCheckoutStoreSlug } from "@/lib/checkoutStoreContext";
import { BadgeCheck } from "lucide-react";

const Store = () => {
  const { username: storeSlug } = useParams();
  const {
    isTenantMode,
    storeName,
    storeLogo,
    storeSettings,
    ownerId: displayOwnerId,
    loading: displayLoading,
  } = useStoreDisplay(storeSlug);
  const tenant = useTenantStore(storeSlug);
  useStoreVisitTracking(isTenantMode ? storeSlug : undefined);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
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

  const tenantProducts = useStoreProductsPage(storeSlug, {
    category: tenantCategoryFilter,
    search: debouncedSearch,
    enabled: isTenantMode,
  });
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(STORE_PRODUCTS_PAGE_SIZE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [filterPriceRange, setFilterPriceRange] = useState<[number, number]>([0, 0]);
  const [filterSizes, setFilterSizes] = useState<string[]>([]);

  const { addToCart, cartItems, cartCount, updateQuantity, cartTotal, setStoreOwner } = useCart();
  const { trackAddToCart } = useMetaPixel();
  const { favorites, toggleFavorite, isFavorite, count: favCount } = useFavorites(storeSlug);
  const { toast } = useToast();
  const navigate = useNavigate();

  const sentinelRef = useRef<HTMLDivElement>(null);
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
    if (isTenantMode) {
      setAllProducts(tenantProducts.products);
      setIsLoading(tenantProducts.loading);
    } else {
      setAllProducts(getProductsByCategory(selectedCategory));
    }
    setVisibleCount(STORE_PRODUCTS_PAGE_SIZE);
  }, [selectedCategory, isTenantMode, tenantProducts.products, tenantProducts.loading]);

  const loadData = useCallback(async (force = false) => {
    if (isTenantMode) {
      if (force) {
        tenant.refetch();
        tenantProducts.refetch();
      }
      return;
    }
    setIsLoading(true);
    try {
      const [cats] = await Promise.all([getCategories(force), loadProducts(force)]);
      setCategories([{ id: "all", name: "الكل", order: -1 }, ...cats]);
      setAllProducts(getProductsByCategory(selectedCategory));
    } catch {
      setCategories([{ id: "all", name: "الكل", order: -1 }]);
    }
    setIsLoading(false);
  }, [selectedCategory, isTenantMode, tenant, tenantProducts]);

  useEffect(() => {
    if (isTenantMode && !displayLoading) {
      setCategories([{ id: "all", name: "الكل", order: -1 }, ...tenant.categories]);
    }
  }, [isTenantMode, displayLoading, tenant.categories]);

  useEffect(() => { if (!isTenantMode) loadData(); }, [loadData, isTenantMode]);

  const bannerImages = storeSettings.bannerImages || [];
  useEffect(() => {
    if (bannerImages.length > 1) {
      const interval = setInterval(() => {
        setIsTransitioning(true);
        setTimeout(() => { setCurrentImageIndex(prev => (prev + 1) % bannerImages.length); setIsTransitioning(false); }, 200);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [bannerImages.length]);

  // --- Compute max price and available sizes ---
  const maxPrice = useMemo(() => Math.max(...allProducts.map(p => p.price), 100000), [allProducts]);
  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    allProducts.forEach(p => p.sizes?.forEach(s => sizes.add(s)));
    return Array.from(sizes);
  }, [allProducts]);

  // Initialize filter range
  useEffect(() => {
    if (filterPriceRange[1] === 0 && maxPrice > 0) {
      setFilterPriceRange([0, maxPrice]);
    }
  }, [maxPrice, filterPriceRange]);

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
      if (visibleCount < displayProducts.length) {
        setVisibleCount((prev) => Math.min(prev + STORE_PRODUCTS_PAGE_SIZE, displayProducts.length));
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayProducts.length, visibleCount, isTenantMode, tenantProducts.hasMore, tenantProducts.loadMore]);

  const visibleProducts = displayProducts.slice(0, visibleCount);

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

  // --- Cart helpers ---
  const cartQuantityById = useMemo(() => {
    const map = new Map<string, number>();
    cartItems.forEach((i) => {
      map.set(i.product.id, (map.get(i.product.id) ?? 0) + i.quantity);
    });
    return map;
  }, [cartItems]);

  const handleViewProduct = useCallback((productId: string) => {
    const previewProduct =
      displayProducts.find((p) => p.id === productId) ??
      allProducts.find((p) => p.id === productId);
    navigate(getProductPath(productId, isTenantMode ? storeSlug : null), {
      state: previewProduct ? { previewProduct } : undefined,
    });
  }, [isTenantMode, storeSlug, navigate, displayProducts, allProducts]);

  const handleUpdateQuantity = useCallback((productId: string, qty: number) => {
    const lines = cartItems.filter((i) => i.product.id === productId);
    const simpleLine = lines.find((i) => !i.selectedSize && !i.selectedColor);
    if (!simpleLine) {
      handleViewProduct(productId);
      toast({
        title: "افتح صفحة المنتج",
        description: "لتعديل الكمية أو الخيارات (مقاس/لون)",
      });
      return;
    }
    updateQuantity(productId, qty, simpleLine.selectedSize, simpleLine.selectedColor);
  }, [cartItems, updateQuantity, handleViewProduct, toast]);

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
    if (isTenantMode && tenant.storeInfo?.ownerId) {
      setStoreOwner(tenant.storeInfo.ownerId);
    }
    addToCart(product);
    trackAddToCart(product.id, product.name, product.price);
    toast({
      title: "✅ تمت الإضافة",
      description: `${product.name} أُضيف إلى السلة`,
    });
  }, [isTenantMode, tenant.storeInfo?.ownerId, setStoreOwner, addToCart, trackAddToCart, toast, handleViewProduct]);

  // --- Share ---
  const handleShare = async (product: Product) => {
    const productUrl = isTenantMode ? `${window.location.origin}/store/${storeSlug}/product/${product.id}` : `${window.location.origin}/product-details/${product.id}`;
    const shareData = { title: product.name, text: `${product.name} - ${product.price.toLocaleString()} د.ع`, url: productUrl };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); toast({ title: "تم النسخ", description: "تم نسخ رابط المنتج" }); }
    } catch {}
  };

  // --- Voice search ---
  const toggleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({ title: "غير مدعوم", description: "البحث الصوتي غير مدعوم في هذا المتصفح", variant: "destructive" });
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (isListening) { setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.onresult = (e: any) => { setSearchQuery(e.results[0][0].transcript); setIsListening(false); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  // --- Sort ---
  const cycleSortBy = () => setSortBy(prev => prev === "default" ? "price-asc" : prev === "price-asc" ? "price-desc" : "default");
  const sortLabel = sortBy === "price-asc" ? "الأقل سعراً" : sortBy === "price-desc" ? "الأعلى سعراً" : "ترتيب";

  // Favorite products
  const favoriteProducts = useMemo(() => allProducts.filter(p => favorites.includes(p.id)), [allProducts, favorites]);

  // Active filter count
  const activeFilterCount = (filterPriceRange[0] > 0 || (filterPriceRange[1] > 0 && filterPriceRange[1] < maxPrice) ? 1 : 0) + (filterSizes.length > 0 ? 1 : 0);

  const themeColors = {
    backgroundColor: storeSettings.menuBackgroundColor,
    textColor: storeSettings.menuTextColor,
    accentColor: storeSettings.menuAccentColor,
    font: (storeSettings as any).storeFont || 'Tajawal',
  };

  return (
    <>
      <SEOHead
        title={storeName ? `${storeName} — متجر إلكتروني` : 'المتجر'}
        description={storeName ? `تسوق من ${storeName} — منتجات متنوعة بأسعار منافسة` : 'متجر إلكتروني'}
        url={storeSlug ? `${window.location.origin}/store/${storeSlug}` : undefined}
        storeName={storeName}
      />
    <StoreThemeProvider colors={themeColors}>
    <div className="min-h-screen bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <MarketingScripts
        storeSlug={isTenantMode ? storeSlug : undefined}
        storeOwnerId={isTenantMode ? tenant.storeInfo?.ownerId : undefined}
      />

      {/* Pull to refresh indicator */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center py-3 bg-primary/10 backdrop-blur-sm">
          <RefreshCw className="w-5 h-5 text-primary animate-spin" />
        </div>
      )}

      {/* Header */}
      <div className="bg-card/90 backdrop-blur-xl border-b border-border/60 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1">
              <CartDrawer storeSlug={isTenantMode ? storeSlug : undefined}>
                <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
                  <ShoppingCart className="w-5 h-5 text-foreground" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold animate-scale-in">
                      {cartCount}
                    </span>
                  )}
                </button>
              </CartDrawer>
              <FavoritesDrawer
                favorites={favoriteProducts}
                count={favCount}
                onAddToCart={handleAddToCart}
                onRemoveFavorite={toggleFavorite}
                onViewProduct={handleViewProduct}
              />
            </div>
            <div className="text-center flex-1 flex items-center justify-center gap-2.5 min-w-0">
              {storeLogo && (
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-md" />
                  <img src={storeLogo} alt="" className="relative w-9 h-9 rounded-full object-cover ring-2 ring-primary/20" />
                </div>
              )}
              <p className="font-bold text-base text-foreground truncate flex items-center gap-1 justify-center">
                {storeName}
                {isTenantMode && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
              </p>
            </div>
            <div className="w-10" />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="search"
              placeholder="ابحث عن منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pr-10 pl-12 rounded-xl bg-muted/70 border border-transparent text-right text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:bg-card focus:border-primary/30 transition-all text-foreground"
            />
            <button
              onClick={toggleVoiceSearch}
              type="button"
              aria-label={isListening ? "إيقاف البحث الصوتي" : "البحث الصوتي"}
              className={`absolute left-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors ${isListening ? 'text-destructive animate-pulse bg-destructive/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <StorefrontTrustBar />

      <div className="max-w-3xl mx-auto">
        {/* Banner — hero */}
        {bannerImages.length > 0 && (
          <div className="px-4 pt-4">
            <div className="relative h-44 sm:h-56 overflow-hidden rounded-2xl shadow-lg ring-1 ring-border/40">
              <div className={`w-full h-full transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-[1.03]' : 'opacity-100 scale-100'}`}>
                <img src={bannerImages[currentImageIndex]} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 right-4 left-4 text-right pointer-events-none">
                <p className="text-lg sm:text-xl font-bold text-white">{storeName}</p>
                <p className="text-xs text-white/90 mt-0.5">تسوق بثقة — توصيل سريع ودفع آمن</p>
              </div>
              {bannerImages.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {bannerImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setIsTransitioning(true); setTimeout(() => { setCurrentImageIndex(i); setIsTransitioning(false); }, 200); }}
                      className={`transition-all rounded-full ${currentImageIndex === i ? "bg-primary w-6 h-2" : "bg-background/70 w-2 h-2 hover:bg-background"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories with swipe */}
        <div
          className="px-4 pt-4 pb-1"
          ref={categoriesRef}
          onTouchStart={handleCategoryTouchStart}
          onTouchEnd={handleCategoryTouchEnd}
        >
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap text-xs font-semibold ${
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground scale-105"
                    : "bg-card hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar: Sort, Filter, View Mode */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={cycleSortBy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                sortBy !== "default" ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortLabel}
            </button>
            <StoreFilterDrawer
              maxPrice={maxPrice}
              currentRange={filterPriceRange}
              availableSizes={availableSizes}
              selectedSizes={filterSizes}
              onApply={(range, sizes) => { setFilterPriceRange(range); setFilterSizes(sizes); }}
              onReset={() => { setFilterPriceRange([0, maxPrice]); setFilterSizes([]); }}
              activeFilterCount={activeFilterCount}
            />
          </div>
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="px-4 pb-28 max-w-3xl mx-auto">
        {searchQuery && (
          <p className="text-xs text-muted-foreground text-right mb-3">
            {displayProducts.length} نتيجة
          </p>
        )}

        {isLoading ? (
          <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-3" : "space-y-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductSkeleton key={i} viewMode={viewMode} />
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center text-3xl">
              🛍️
            </div>
            <h3 className="text-lg font-bold mb-1 text-foreground">
              {searchQuery ? "لا توجد نتائج" : "لا توجد منتجات"}
            </h3>
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "جرب كلمات بحث مختلفة" : "تصفح الأقسام الأخرى"}
            </p>
          </div>
        ) : (
          <>
            <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-3" : "space-y-3"}>
              {visibleProducts.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  viewMode={viewMode}
                  isFavorite={isFavorite(product.id)}
                  cartQuantity={cartQuantityById.get(product.id) ?? 0}
                  onToggleFavorite={toggleFavorite}
                  onAddToCart={handleAddToCart}
                  onUpdateQuantity={handleUpdateQuantity}
                  onView={handleViewProduct}
                  onShare={handleShare}
                  index={i}
                />
              ))}
            </div>
            {visibleCount < displayProducts.length && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      <StorefrontFooter
        storeName={storeName || 'المتجر'}
        storeSlug={storeSlug}
        whatsappNumber={(storeSettings as any).whatsappNumber || tenant.storeInfo?.whatsappNumber}
        returnPolicy={tenant.storeInfo?.returnPolicy}
        privacyPolicy={tenant.storeInfo?.privacyPolicy}
      />

      <WhatsAppButton phoneNumber={(storeSettings as any).whatsappNumber || tenant.storeInfo?.whatsappNumber || ""} />

      {/* Fixed Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent safe-area-bottom">
          <button onClick={() => navigate(getCheckoutPath(isTenantMode ? storeSlug : null))} className="w-full max-w-3xl mx-auto block">
            <div className="bg-primary rounded-2xl transition-colors">
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="relative w-9 h-9 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-primary-foreground" />
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ring-2 ring-primary">
                      {cartCount}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-primary-foreground">
                    {cartTotal.toLocaleString()} د.ع
                  </span>
                </div>
                <span className="text-sm font-bold text-primary-foreground">إتمام الطلب ←</span>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
    </StoreThemeProvider>
    </>
  );
};

export default Store;
