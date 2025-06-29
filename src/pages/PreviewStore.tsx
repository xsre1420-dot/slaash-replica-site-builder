
import { X, ShoppingCart, Plus, Trash2, Search, Heart, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { categories, getProductsByCategory } from "@/data/dummyData";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";

const PreviewStore = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const { addToCart, cartCount } = useCart();
  const { storeName, storeLogo, storeSettings } = useStore();
  const navigate = useNavigate();

  // Get ordered banner images (primary first, then others)
  const orderedBannerImages = () => {
    if (storeSettings.bannerImages.length === 0) return [];
    
    const images = [...storeSettings.bannerImages];
    const primaryImage = images[storeSettings.primaryBannerIndex];
    const otherImages = images.filter((_, index) => index !== storeSettings.primaryBannerIndex);
    
    return [primaryImage, ...otherImages];
  };

  const bannerImages = orderedBannerImages();

  // This effect will run every time the component renders, ensuring we have the latest products
  useEffect(() => {
    setProducts(getProductsByCategory(selectedCategory));
  }, [selectedCategory]);

  // Handle adding a product to the cart
  const handleAddToCart = (product: Product) => {
    addToCart(product);
  };

  // Navigate to product details
  const handleViewProduct = (productId: string) => {
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

  // Enhanced auto-rotate with smooth transitions
  useEffect(() => {
    if (bannerImages.length > 1) {
      const interval = setInterval(() => {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length);
          setIsTransitioning(false);
        }, 150);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [bannerImages.length]);

  // Handle manual image navigation with smooth transitions
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
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <Link to="/builder" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-600" />
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">الموقع</p>
                <p className="font-semibold text-gray-800">{storeName}</p>
              </div>
              {storeLogo && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 p-0.5">
                  <img src={storeLogo} alt={storeName} className="w-full h-full object-cover rounded-full" />
                </div>
              )}
            </div>
            
            <div className="w-10" />
          </div>
          
          {/* Modern Search Bar */}
          <div className="relative">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="search"
              placeholder="ابحث عن وجبة..."
              className="w-full h-12 pr-12 pl-4 rounded-2xl bg-gray-100 border-0 text-right placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Popular Food Categories */}
      <div className="px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <button className="text-orange-500 text-sm font-medium">عرض الكل</button>
          <h2 className="text-xl font-bold text-gray-800">الأصناف الشائعة</h2>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button 
              key={category.id}
              className={`flex flex-col items-center min-w-[80px] py-3 px-4 rounded-2xl transition-all duration-200 ${
                selectedCategory === category.id 
                  ? "bg-orange-500 text-white shadow-lg" 
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <div className="text-2xl mb-2">🍽️</div>
              <span className="text-xs font-medium whitespace-nowrap">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Enhanced Promotional Banner */}
      {bannerImages.length > 0 && (
        <div className="px-6 mb-6">
          <div className="relative h-48 overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 to-pink-600">
            <div 
              className={`w-full h-full transition-all duration-500 ease-in-out ${
                isTransitioning ? 'opacity-80 scale-105' : 'opacity-100 scale-100'
              }`}
            >
              <img
                src={bannerImages[currentImageIndex]}
                alt="Promotional Banner"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
            
            {/* Banner content */}
            <div className="absolute inset-0 flex flex-col justify-center pr-6 text-white">
              <h3 className="text-2xl font-bold mb-2">خصم 50%</h3>
              <p className="text-sm opacity-90">اعرف المزيد...</p>
            </div>
            
            {/* Enhanced Image Navigation Dots */}
            {bannerImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {bannerImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageNavigation(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      currentImageIndex === index 
                        ? "bg-white w-6" 
                        : "bg-white/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modern Products Grid */}
      <div className="px-6 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <div className="text-4xl">🍽️</div>
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد منتجات بعد</h3>
            <p className="text-gray-500 mb-6">ابدأ بإضافة وجباتك من قسم البناء</p>
            <Link to="/add-product">
              <Button className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-full px-8">
                <Plus className="w-4 h-4 ml-2" />
                إضافة أول وجبة
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-32 object-cover"
                    loading="lazy"
                  />
                  <button
                    className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      favorites.includes(product.id) 
                        ? 'bg-red-500 text-white' 
                        : 'bg-white text-gray-400 hover:text-red-500'
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
                  <h3 className="font-bold text-gray-800 mb-1 text-right line-clamp-1">
                    {product.name}
                  </h3>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">4.5</span>
                    </div>
                    <span className="font-bold text-gray-800">
                      {product.price.toLocaleString()} د.ع
                    </span>
                  </div>
                  
                  <Button 
                    size="sm"
                    className="w-full h-9 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-full border-0"
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

      {/* Modern Cart Button */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <Link to="/checkout">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110">
              <ShoppingCart className="w-6 h-6 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse">
                  {cartCount}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default PreviewStore;
