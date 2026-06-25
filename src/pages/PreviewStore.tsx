import { ArrowRight, ShoppingCart, Plus, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getCategories } from "@/services/productService";
import {
  fetchStorefrontProductsByOwnerId,
  STOREFRONT_PRODUCTS_CHANGED,
} from "@/services/storefrontProductService";
import { useStoreHydration } from "@/context/StoreBootstrapContext";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import MarketingScripts from "@/components/MarketingScripts";
import OptimizedImage from "@/components/OptimizedImage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PreviewStore = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const { addToCart, cartItems, setStoreOwner } = useCart();
  const { storeName, storeLogo, storeSettings } = useStore();
  const navigate = useNavigate();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cartItems]
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const products = useMemo(() => {
    if (!debouncedSearch.trim()) return allProducts;
    const q = debouncedSearch.trim().toLowerCase();
    return allProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProducts, debouncedSearch]);

  useEffect(() => {
    if (user?.id) setStoreOwner(user.id);
  }, [user?.id, setStoreOwner]);

  // Load categories from Supabase
  useEffect(() => {
    if (!isReady) return;

    const loadCategoriesData = async () => {
      try {
        const categoriesData = await getCategories(true);
        const allCategories = [
          { id: "all", name: "الكل", order: -1 },
          ...categoriesData
        ];
        setCategories(allCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategories([{ id: "all", name: "الكل", order: -1 }]);
      }
    };
    loadCategoriesData();

    let lastFocusRefresh = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefresh < 60_000) return;
      lastFocusRefresh = now;
      loadCategoriesData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isReady, hydrationVersion]);

  const bannerImages = storeSettings.bannerImages || [];

  const filterByCategory = useCallback(
    (items: Product[]) => {
      if (selectedCategory === 'all') return items;
      const cat = categories.find((c) => c.id === selectedCategory);
      const categoryName = cat?.name ?? selectedCategory;
      return items.filter((p) => p.category === categoryName);
    },
    [selectedCategory, categories]
  );

  // Load published products directly from DB (same source as inventory)
  useEffect(() => {
    if (!isReady || !user?.id) return;

    const loadProductsData = async () => {
      setProductsLoading(true);
      try {
        const rows = await fetchStorefrontProductsByOwnerId(user.id);
        setAllProducts(filterByCategory(rows));
      } finally {
        setProductsLoading(false);
      }
    };
    loadProductsData();

    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ ownerId?: string }>).detail;
      if (detail?.ownerId && detail.ownerId !== user.id) return;
      loadProductsData();
    };

    window.addEventListener(STOREFRONT_PRODUCTS_CHANGED, onChanged);

    let lastFocusRefresh = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefresh < 15_000) return;
      lastFocusRefresh = now;
      loadProductsData();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener(STOREFRONT_PRODUCTS_CHANGED, onChanged);
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedCategory, isReady, hydrationVersion, user?.id, filterByCategory]);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
  };

  const handleViewProduct = (productId: string) => {
    const previewProduct = products.find((p) => p.id === productId) ?? allProducts.find((p) => p.id === productId);
    navigate(`/product-details/${productId}`, {
      state: previewProduct ? { previewProduct } : undefined,
    });
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  useEffect(() => {
    if (bannerImages.length <= 1) return;
    let transitionTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      transitionTimer = setTimeout(() => {
        setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length);
        setIsTransitioning(false);
        transitionTimer = null;
      }, 150);
    }, 2500);
    return () => {
      clearInterval(interval);
      if (transitionTimer) clearTimeout(transitionTimer);
    };
  }, [bannerImages.length]);

  const handleImageNavigation = (index: number) => {
    if (index !== currentImageIndex) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentImageIndex(index);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const handleImageHover = () => {
    if (bannerImages.length > 1) {
      const nextIndex = (currentImageIndex + 1) % bannerImages.length;
      handleImageNavigation(nextIndex);
    }
  };

  const isStoreOwnerView = Boolean(user?.id);

  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      <MarketingScripts storeOwnerId={user?.id} disabled />
      
      {/* Header with Logo and Store Name */}
      <div className="bg-background sticky top-0 z-40 border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {isStoreOwnerView ? (
              <Link
                to="/builder"
                aria-label="العودة للوحة التحكم"
                className="w-10 h-10 shrink-0 rounded-full bg-muted/80 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <div className="w-10 shrink-0" aria-hidden />
            )}

            <div className="flex items-center justify-center gap-2 min-w-0 flex-1">
              {storeLogo && (
                <img src={storeLogo} alt={storeName} className="w-9 h-9 rounded-full object-cover shrink-0" />
              )}
              <span className="font-bold text-foreground text-base truncate">{storeName}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowSearch((v) => !v)}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-muted/80 border border-border/60 hover:bg-muted transition-colors"
              aria-label={showSearch ? "إخفاء البحث" : "البحث عن منتج"}
              aria-expanded={showSearch}
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {showSearch && (
            <div className="relative mt-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتج..."
                className="w-full h-11 pr-10 pl-4 rounded-xl bg-muted/70 border border-transparent text-right text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:bg-card focus:border-primary/30 transition-all text-foreground"
                autoFocus
              />
            </div>
          )}
        </div>
        
        {/* Categories Row */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide items-center">
          {categories.map((category) => (
            <button 
              key={category.id}
              className={`whitespace-nowrap text-sm font-medium transition-all duration-200 px-4 py-2 rounded-full ${
                selectedCategory === category.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Banner */}
      {bannerImages.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <div 
            className="relative h-44 overflow-hidden rounded-3xl cursor-pointer"
            onMouseEnter={handleImageHover}
          >
            <img
              src={bannerImages[currentImageIndex]}
              alt="بانر المتجر"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            
            {bannerImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
                {bannerImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageNavigation(index)}
                    className={`transition-all duration-200 rounded-full ${
                      currentImageIndex === index 
                        ? "bg-white w-6 h-2" 
                        : "bg-white/60 w-2 h-2"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Count */}
      <div className="px-4 py-4">
        <span className="text-sm font-medium text-foreground">
          {productsLoading ? 'جاري التحميل...' : `${products.length} منتجات`}
        </span>
      </div>

      {/* Products Grid */}
      <div className="px-4 pb-28">
        {!isReady || productsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3 mr-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
              <div className="text-4xl">🛍️</div>
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">
              {searchQuery.trim() ? 'لا توجد نتائج للبحث' : 'لا توجد منتجات بعد'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery.trim() ? 'جرّب كلمة بحث أخرى' : 'ابدأ بإضافة منتجاتك من قسم المنتجات'}
            </p>
            {!searchQuery.trim() && (
              <Link to="/add-product">
                <Button className="rounded-full px-8 min-h-[44px]">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة أول منتج
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-card rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="relative bg-muted aspect-square">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain p-4"
                    loading="lazy"
                  />
                  
                  {/* Discount Badge */}
                  {product.discountType && product.discountType !== 'none' && (
                    <div className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-2 py-1 rounded-full shadow-lg">
                      <span className="text-[10px] font-bold">
                        -{product.discountType === 'percentage' ? `${product.discountValue}%` : `${product.discountValue?.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="p-3">
                  <div className="text-sm font-medium text-foreground mb-1 text-right line-clamp-2">
                    {product.name}
                  </div>
                  <div className="text-right">
                    {product.discountType && product.discountType !== 'none' && product.originalPrice ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs text-muted-foreground line-through">
                          {product.originalPrice.toLocaleString()} د.ع
                        </span>
                        <span className="text-sm font-bold text-red-600">
                          {product.price.toLocaleString()} د.ع
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-foreground">
                        {product.price.toLocaleString()} د.ع
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent safe-area-bottom">
          <Link to="/checkout" className="block w-full max-w-3xl mx-auto">
            <div className="rounded-2xl bg-primary shadow-md shadow-primary/15">
              <div className="flex items-center justify-between gap-3 px-4 py-3" dir="rtl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                    <ShoppingCart className="h-4 w-4 text-primary-foreground" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card text-[10px] font-bold text-primary ring-2 ring-primary">
                      {cartCount}
                    </span>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-primary-foreground leading-tight">
                      {cartTotal.toLocaleString()} د.ع
                    </p>
                    <p className="text-[10px] text-primary-foreground/75">
                      {cartCount} {cartCount === 1 ? "منتج" : "منتجات"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-primary-foreground">عرض السلة</span>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};

export default PreviewStore;
