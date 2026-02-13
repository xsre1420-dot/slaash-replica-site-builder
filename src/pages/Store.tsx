import { X, ShoppingCart, Plus, Search, Heart, Star, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { getProductsByCategory, getCategories, loadProducts } from "@/data/dummyData";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import MetaPixel from "@/components/MetaPixel";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Button } from "@/components/ui/button";
import CartDrawer from "@/components/CartDrawer";
import WhatsAppButton from "@/components/WhatsAppButton";

const Store = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");
  const { addToCart, cartItems, cartCount } = useCart();
  const { storeName, storeLogo, storeSettings } = useStore();
  const { trackAddToCart, trackViewContent } = useMetaPixel();
  const navigate = useNavigate();

  useEffect(() => {
    const loadCategoriesData = async () => {
      try {
        const categoriesData = await getCategories();
        setCategories([{ id: "all", name: "الكل", order: -1 }, ...categoriesData]);
      } catch {
        setCategories([{ id: "all", name: "الكل", order: -1 }]);
      }
    };
    loadCategoriesData();
    const handleFocus = () => loadCategoriesData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const bannerImages = storeSettings.bannerImages || [];

  useEffect(() => {
    const loadProductsData = async () => {
      await loadProducts();
      setProducts(getProductsByCategory(selectedCategory));
    };
    loadProductsData();
  }, [selectedCategory]);

  // Filtered & sorted products
  const displayProducts = useMemo(() => {
    let filtered = products;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (sortBy === "price-asc") filtered = [...filtered].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, searchQuery, sortBy]);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    trackAddToCart(product.id, product.name, product.price);
  };

  const handleViewProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) trackViewContent(product.id, product.name, product.price);
    navigate(`/product-details/${productId}`);
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
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
      setTimeout(() => { setCurrentImageIndex(index); setIsTransitioning(false); }, 150);
    }
  };

  const cycleSortBy = () => {
    setSortBy(prev => prev === "default" ? "price-asc" : prev === "price-asc" ? "price-desc" : "default");
  };

  const sortLabel = sortBy === "price-asc" ? "الأقل سعراً" : sortBy === "price-desc" ? "الأعلى سعراً" : "ترتيب";

  return (
    <div className="min-h-screen" style={{ backgroundColor: storeSettings.menuBackgroundColor, color: storeSettings.menuTextColor }}>
      <MetaPixel />

      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-3">
            <CartDrawer>
              <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
                <ShoppingCart className="w-5 h-5 text-gray-700" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </CartDrawer>
            <div className="text-center flex-1 flex items-center justify-center gap-2">
              {storeLogo && <img src={storeLogo} alt="" className="w-8 h-8 rounded-full object-cover" />}
              <p className="font-bold text-lg text-gray-800">{storeName}</p>
            </div>
            <div className="w-10" />
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="search"
              placeholder="ابحث عن منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pr-10 pl-4 rounded-xl bg-gray-100 border-0 text-right text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary/30 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button 
              key={cat.id}
              className={`px-4 py-2 rounded-xl transition-all duration-200 whitespace-nowrap text-xs font-medium ${
                selectedCategory === cat.id 
                  ? "bg-primary text-white shadow-sm" 
                  : "bg-white hover:bg-gray-50 border border-gray-200 text-gray-600"
              }`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sort bar */}
      <div className="px-4 pb-2">
        <button
          onClick={cycleSortBy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            sortBy !== "default" ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
          }`}
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortLabel}
        </button>
      </div>

      {/* Banner */}
      {bannerImages.length > 0 && (
        <div className="px-4 mb-4">
          <div className="relative h-40 sm:h-48 overflow-hidden rounded-2xl">
            <div className={`w-full h-full transition-all duration-150 ${isTransitioning ? 'opacity-95 scale-105' : 'opacity-100 scale-100'}`}>
              <img src={bannerImages[currentImageIndex]} alt="Banner" className="w-full h-full object-cover" loading="lazy" />
            </div>
            {bannerImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {bannerImages.map((_, i) => (
                  <button key={i} onClick={() => handleImageNavigation(i)}
                    className={`transition-all rounded-full ${currentImageIndex === i ? "bg-white w-6 h-2" : "bg-white/60 w-2 h-2"}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="px-4 pb-24">
        {displayProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center text-3xl">🛍️</div>
            <h3 className="text-lg font-bold mb-1" style={{ color: storeSettings.menuTextColor }}>
              {searchQuery ? "لا توجد نتائج" : "لا توجد منتجات"}
            </h3>
            <p className="text-gray-500 text-sm">
              {searchQuery ? "جرب كلمات بحث مختلفة" : "تصفح الأقسام الأخرى"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {displayProducts.map((product, i) => (
              <div 
                key={product.id} 
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="relative aspect-square overflow-hidden">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                  
                  {product.discountType && product.discountType !== 'none' && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-0.5 rounded-lg shadow text-[10px] font-bold">
                      {product.discountType === 'percentage' ? `${product.discountValue}%-` : `${product.discountValue?.toLocaleString()}-`}
                    </div>
                  )}
                  
                  <button
                    className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      favorites.includes(product.id) ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400 hover:text-red-500'
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
                  >
                    <Heart className={`w-3.5 h-3.5 ${favorites.includes(product.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
                
                <div className="p-3">
                  <h3 className="font-semibold text-sm mb-1 text-right line-clamp-1" style={{ color: storeSettings.menuTextColor }}>
                    {product.name}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-current" />
                      <span className="text-[10px] text-gray-500">4.5</span>
                    </div>
                    <div className="text-right">
                      {product.discountType && product.discountType !== 'none' && product.originalPrice ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-gray-400 line-through">{product.originalPrice.toLocaleString()}</span>
                          <span className="text-sm font-bold text-red-600">{product.price.toLocaleString()} د.ع</span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold" style={{ color: storeSettings.menuTextColor }}>
                          {product.price.toLocaleString()} د.ع
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Button 
                    size="sm"
                    className="w-full h-8 text-xs text-white rounded-xl border-0 bg-primary hover:bg-primary/90 transition-all shadow-sm"
                    onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                  >
                    <Plus className="w-3 h-3 ml-1" />
                    أضف للسلة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp Button */}
      <WhatsAppButton phoneNumber={(storeSettings as any).whatsappNumber || ""} />

      {/* Fixed Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <button onClick={() => navigate('/checkout')} className="w-full">
            <div className="bg-foreground rounded-2xl shadow-xl">
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ShoppingCart className="w-5 h-5 text-background" />
                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                      {cartCount}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-background">
                    {cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toLocaleString()} د.ع
                  </span>
                </div>
                <span className="text-sm font-bold text-background">إتمام الطلب ←</span>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default Store;
