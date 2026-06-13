import { X, ShoppingCart, Plus, Trash2, Search, Heart, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { getProductsByCategory, getCategories, loadProducts } from "@/services/productService";
import { useStoreHydration } from "@/context/StoreBootstrapContext";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import MarketingScripts from "@/components/MarketingScripts";
import { useMetaPixel } from "@/hooks/useMetaPixel";
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
  const { trackAddToCart, trackViewContent } = useMetaPixel();
  const navigate = useNavigate();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
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

  // Load products when category changes only (search is client-side)
  useEffect(() => {
    if (!isReady) return;

    const loadProductsData = async () => {
      setProductsLoading(true);
      try {
        await loadProducts(true);
        setAllProducts(getProductsByCategory(selectedCategory));
      } finally {
        setProductsLoading(false);
      }
    };
    loadProductsData();
  }, [selectedCategory, isReady, hydrationVersion]);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    trackAddToCart(product.id, product.name, product.price);
  };

  const handleViewProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      trackViewContent(product.id, product.name, product.price);
    }
    navigate(`/product-details/${productId}`);
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  useEffect(() => {
    if (bannerImages.length > 1) {
      const interval = setInterval(() => {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length);
          setIsTransitioning(false);
        }, 150);
      }, 2500);
      return () => clearInterval(interval);
    }
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

  return (
    <div className="min-h-screen bg-background font-arabic" dir="rtl">
      <MarketingScripts storeOwnerId={user?.id} disabled />
      
      {/* Header with Logo and Store Name */}
      <div className="bg-background sticky top-0 z-40 border-b border-border">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {storeLogo && (
                <img src={storeLogo} alt={storeName} className="w-10 h-10 rounded-full object-cover shrink-0" />
              )}
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-bold text-foreground text-base truncate">{storeName}</span>
                <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={() => setShowSearch((v) => !v)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-muted transition-colors shrink-0"
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
                className="w-full h-11 pr-10 pl-4 rounded-xl bg-muted/70 border border-transparent text-right text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 focus:bg-card focus:border-primary/30 transition-all text-foreground"
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
          <button className="p-2 flex-shrink-0">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
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

      {/* Horizontal Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-background via-background to-transparent">
          <Link to="/checkout">
            <div className="accent-gradient rounded-full shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative rounded-full p-3">
                    <ShoppingCart className="w-6 h-6 text-white" />
                    <span className="absolute -top-1 -right-1 bg-white text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md">
                      {cartCount}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-white/70">المبلغ الكلي</div>
                    <div className="text-lg font-bold text-white">
                      {cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toLocaleString()} د.ع
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <span>عرض السلة</span>
                  <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};

export default PreviewStore;
