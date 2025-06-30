import { X, ShoppingCart, Plus, Trash2, Search, Heart, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getProductsByCategory } from "@/data/dummyData";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";

const PreviewStore = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const { addToCart, cartItems } = useCart();
  const { storeName, storeLogo, storeSettings } = useStore();
  const navigate = useNavigate();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Load categories from localStorage
  useEffect(() => {
    const savedCategories = localStorage.getItem('categories');
    if (savedCategories) {
      try {
        const parsedCategories = JSON.parse(savedCategories);
        // Add "الكل" category at the beginning
        const allCategories = [
          { id: "all", name: "الكل", order: -1 },
          ...parsedCategories
        ];
        setCategories(allCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategories([{ id: "all", name: "الكل", order: -1 }]);
      }
    } else {
      setCategories([{ id: "all", name: "الكل", order: -1 }]);
    }
  }, []);

  // Only use banner images from settings (no automatic promotional banner)
  const bannerImages = storeSettings.bannerImages || [];

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

  // Enhanced auto-rotate with faster transitions
  useEffect(() => {
    if (bannerImages.length > 1) {
      const interval = setInterval(() => {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length);
          setIsTransitioning(false);
        }, 150);
      }, 2500); // Faster rotation
      return () => clearInterval(interval);
    }
  }, [bannerImages.length]);

  // Handle manual image navigation with faster smooth transitions
  const handleImageNavigation = (index: number) => {
    if (index !== currentImageIndex) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentImageIndex(index);
        setIsTransitioning(false);
      }, 150); // Faster transition
    }
  };

  // Handle hover effects for faster image transitions
  const handleImageHover = () => {
    if (bannerImages.length > 1) {
      const nextIndex = (currentImageIndex + 1) % bannerImages.length;
      handleImageNavigation(nextIndex);
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
      {/* Modern Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <Link to="/builder" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-600" />
            </Link>
            
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">المتجر</p>
                <p className="font-semibold text-gray-800">{storeName}</p>
              </div>
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

      {/* Updated Categories with improved design */}
      <div className="px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <button 
            className="text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            عرض الكل
          </button>
          <h2 className="text-xl font-bold" style={{ color: storeSettings.menuTextColor }}>
            الأصناف
          </h2>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button 
              key={category.id}
              className={`px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap border text-sm font-medium ${
                selectedCategory === category.id 
                  ? "bg-indigo-500 border-indigo-500 text-white" 
                  : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
              style={{
                boxShadow: selectedCategory === category.id 
                  ? '0 4px 20px rgba(99, 102, 241, 0.4), 0 2px 8px rgba(99, 102, 241, 0.2)' 
                  : '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Enhanced Banner with Smoother Transitions */}
      {bannerImages.length > 0 && (
        <div className="px-6 mb-6">
          <div 
            className="relative h-48 overflow-hidden rounded-3xl cursor-pointer"
            onMouseEnter={handleImageHover}
          >
            <div 
              className={`w-full h-full transition-all duration-150 ease-in-out transform ${
                isTransitioning ? 'opacity-95 scale-105' : 'opacity-100 scale-100'
              }`}
            >
              <img
                src={bannerImages[currentImageIndex]}
                alt="Store Banner"
                className="w-full h-full object-cover transition-transform duration-150 hover:scale-110"
                loading="lazy"
              />
            </div>
            
            {/* Reduced gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/2 to-transparent" />
            
            {/* Enhanced Image Navigation Dots */}
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

      {/* Modern Products Grid */}
      <div className="px-6 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <div className="text-4xl">🍽️</div>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: storeSettings.menuTextColor }}>
              لا توجد منتجات بعد
            </h3>
            <p className="text-gray-500 mb-6">ابدأ بإضافة وجباتك من قسم البناء</p>
            <Link to="/add-product">
              <Button 
                className="text-white rounded-full px-8 border-0 shadow-lg"
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
                }}
              >
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
                className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105"
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-32 object-cover transition-transform duration-300 hover:scale-110"
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
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
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

      {/* Updated Cart Button with Blue Design */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <Link to="/checkout">
          <div className="relative">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
              }}
            >
              <ShoppingCart className="w-6 h-6 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-indigo-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse">
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
