import { X, ShoppingCart, Plus, Search, Heart, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getProductsByCategory } from "@/data/dummyData";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
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

  // Only use banner images from settings
  const bannerImages = storeSettings.bannerImages || [];

  // Load products based on selected category
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
      {/* Customer Header - No admin links */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="text-center flex-1">
              <p className="font-bold text-xl text-gray-800">{storeName}</p>
            </div>
            {storeLogo && (
              <img src={storeLogo} alt="Store Logo" className="w-10 h-10 rounded-full object-cover" />
            )}
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
        <div className="flex justify-center items-center mb-4">
          <h2 className="text-xl font-bold" style={{ color: storeSettings.menuTextColor }}>
            الأصناف
          </h2>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
          {categories.map((category) => (
            <button 
              key={category.id}
              className={`px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap border text-sm font-medium ${
                selectedCategory === category.id 
                  ? "text-white" 
                  : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
              style={{
                backgroundColor: selectedCategory === category.id ? 'hsl(248, 53%, 58%)' : undefined,
                borderColor: selectedCategory === category.id ? 'hsl(248, 53%, 58%)' : undefined,
                boxShadow: selectedCategory === category.id 
                  ? '0 8px 25px -5px rgba(120, 119, 198, 0.3), 0 4px 15px -3px rgba(120, 119, 198, 0.2)' 
                  : undefined
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
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <button onClick={() => navigate('/checkout')}>
            <div className="relative">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
                style={{ 
                  background: 'linear-gradient(135deg, hsl(248, 53%, 58%), hsl(248, 53%, 68%))',
                  boxShadow: '0 8px 25px rgba(120, 119, 198, 0.3)'
                }}
              >
                <ShoppingCart className="w-6 h-6 text-white" />
                <span className="absolute -top-2 -right-2 bg-white text-indigo-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse">
                  {cartCount}
                </span>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default Store;