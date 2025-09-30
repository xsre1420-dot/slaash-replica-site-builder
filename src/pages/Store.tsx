import { X, ShoppingCart, Plus, Search, Heart, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getProductsByCategory, getCategories, loadProducts } from "@/data/dummyData";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import MetaPixel from "@/components/MetaPixel";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Button } from "@/components/ui/button";

const Store = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const { addToCart, cartItems } = useCart();
  const { storeName, storeLogo, storeSettings } = useStore();
  const { trackAddToCart, trackViewContent } = useMetaPixel();
  const navigate = useNavigate();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Load categories from Supabase
  useEffect(() => {
    const loadCategoriesData = async () => {
      try {
        console.log('Store: تحميل الفئات من Supabase...');
        const categoriesData = await getCategories();
        console.log('Store: تم تحميل', categoriesData.length, 'فئة');
        // Add "الكل" category at the beginning
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

    // Reload categories when window gains focus (user might have added categories in another tab)
    const handleFocus = () => {
      console.log('Store: إعادة تحميل الفئات عند التركيز على النافذة');
      loadCategoriesData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Only use banner images from settings
  const bannerImages = storeSettings.bannerImages || [];

  // Load products based on selected category
  useEffect(() => {
    const loadProductsData = async () => {
      await loadProducts(); // Ensure products are loaded from Supabase
      setProducts(getProductsByCategory(selectedCategory));
    };
    loadProductsData();
  }, [selectedCategory]);

  // Handle adding a product to the cart
  const handleAddToCart = (product: Product) => {
    addToCart(product);
    // Track Meta Pixel event
    trackAddToCart(product.id, product.name, product.price);
  };

  // Navigate to product details
  const handleViewProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      trackViewContent(product.id, product.name, product.price);
    }
    navigate(`/product-details/${productId}`);
  };

  // Toggle favorite
  const toggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Auto-rotate banner images
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

  // Handle manual image navigation
  const handleImageNavigation = (index: number) => {
    if (index !== currentImageIndex) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentImageIndex(index);
        setIsTransitioning(false);
      }, 150);
    }
  };

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: storeSettings.menuBackgroundColor,
        color: storeSettings.menuTextColor 
      }}
    >
      {/* Meta Pixel Integration */}
      <MetaPixel />
      {/* Customer Header - No admin links */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            {storeLogo && (
              <img src={storeLogo} alt="Store Logo" className="w-12 h-12 rounded-full object-cover" />
            )}
            <div className="text-center flex-1">
              <p className="font-bold text-xl text-gray-800">{storeName}</p>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="search"
              placeholder="ابحث عن منتج..."
              className="w-full h-12 pr-12 pl-4 rounded-2xl bg-gray-100 border-0 text-right placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="px-6 py-4">
        <div className="flex gap-3 overflow-x-auto pb-2 justify-start">
          {categories.map((category) => (
            <button 
              key={category.id}
              className={`px-6 py-3 rounded-2xl transition-all duration-200 whitespace-nowrap text-sm font-medium min-w-fit flex items-center justify-center ${
                selectedCategory === category.id 
                  ? "text-white" 
                  : "bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
              style={{
                backgroundColor: selectedCategory === category.id ? 'hsl(248, 53%, 58%)' : undefined
              }}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Banner Images */}
      {bannerImages.length > 0 && (
        <div className="px-6 mb-6">
          <div className="relative h-48 overflow-hidden rounded-3xl">
            <div 
              className={`w-full h-full transition-all duration-150 ease-in-out transform ${
                isTransitioning ? 'opacity-95 scale-105' : 'opacity-100 scale-100'
              }`}
            >
              <img
                src={bannerImages[currentImageIndex]}
                alt="Store Banner"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            
            {/* Image Navigation Dots */}
            {bannerImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
                {bannerImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageNavigation(index)}
                    className={`transition-all duration-150 ease-in-out rounded-full ${
                      currentImageIndex === index 
                        ? "bg-white w-8 h-3 shadow-lg" 
                        : "bg-white/70 w-3 h-3 hover:bg-white/90 hover:scale-110"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="px-6 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <div className="text-4xl">🍽️</div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: storeSettings.menuTextColor }}>
              لا توجد منتجات في هذا القسم
            </h3>
            <p className="text-gray-500">تصفح الأقسام الأخرى لمشاهدة المنتجات المتوفرة</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="relative overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  <button
                    className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                      favorites.includes(product.id) 
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white scale-110' 
                        : 'bg-white text-gray-400 hover:text-red-500 hover:scale-110'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product.id);
                    }}
                  >
                    <Heart className={`w-4 h-4 ${favorites.includes(product.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
                
                <div className="p-4">
                  <h3 className="font-bold mb-1 text-right line-clamp-1" style={{ color: storeSettings.menuTextColor }}>
                    {product.name}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">4.5</span>
                    </div>
                    <span className="font-bold" style={{ color: storeSettings.menuTextColor }}>
                      {product.price.toLocaleString()} د.ع
                    </span>
                  </div>
                  
                  <Button 
                    size="sm"
                    className="w-full h-9 text-white rounded-full border-0 transition-all duration-200 hover:scale-105 shadow-lg"
                    style={{ 
                      background: 'linear-gradient(135deg, hsl(248, 53%, 58%), hsl(248, 53%, 68%))',
                      boxShadow: '0 4px 15px rgba(120, 119, 198, 0.3)'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                  >
                    أضف للسلة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <button onClick={() => navigate('/checkout')} className="w-full">
            <div className="bg-black rounded-full shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative bg-white rounded-full p-4">
                    <ShoppingCart className="w-7 h-7 text-black" strokeWidth={2.5} />
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg">
                      {cartCount}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-gray-400">المبلغ الكلي</div>
                    <div className="text-lg font-bold text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      IQD {cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>عرض السلة</span>
                  <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default Store;