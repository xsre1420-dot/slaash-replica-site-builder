
import { X, ShoppingCart, Plus, Trash2 } from "lucide-react";
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

  // Enhanced auto-rotate with smooth transitions
  useEffect(() => {
    if (bannerImages.length > 1) {
      const interval = setInterval(() => {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length);
          setIsTransitioning(false);
        }, 150);
      }, 4000); // Slightly faster rotation
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

  // Dynamic styles based on settings
  const dynamicStyles = {
    backgroundColor: storeSettings.menuBackgroundColor,
    color: storeSettings.menuTextColor
  };

  return (
    <div className="min-h-screen" style={dynamicStyles}>
      {/* Header */}
      <div className="text-white p-4 rounded-b-3xl" style={{ backgroundColor: storeSettings.menuAccentColor }}>
        <div className="flex justify-between items-center mb-4">
          <Link to="/builder">
            <X className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{storeName}</h1>
            {storeLogo && (
              <img src={storeLogo} alt={storeName} className="w-8 h-8 object-contain" />
            )}
          </div>
          <div className="w-6" />
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <input
            type="search"
            placeholder="ابحث عن وجبة..."
            className="w-full p-2 pl-10 pr-4 rounded-full text-right text-dark-green"
          />
          <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex justify-end gap-2 p-4 overflow-x-auto shadow-sm" style={{ backgroundColor: storeSettings.menuBackgroundColor }}>
        {categories.map((category) => (
          <button 
            key={category.id}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
              selectedCategory === category.id 
                ? "text-white shadow-lg transform scale-105" 
                : "hover:opacity-80 hover:scale-102"
            }`}
            style={selectedCategory === category.id 
              ? { backgroundColor: storeSettings.menuAccentColor } 
              : { 
                  backgroundColor: `${storeSettings.menuAccentColor}20`, 
                  color: storeSettings.menuTextColor 
                }
            }
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Enhanced Header Images Section */}
      {bannerImages.length > 0 && (
        <div className="relative bg-white shadow-sm">
          <div className="relative h-64 overflow-hidden rounded-b-2xl">
            <div 
              className={`w-full h-full transition-all duration-500 ease-in-out ${
                isTransitioning ? 'opacity-80 scale-105' : 'opacity-100 scale-100'
              }`}
            >
              <img
                src={bannerImages[currentImageIndex]}
                alt="Header"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            
            {/* Gradient overlay for better text visibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            
            {/* Enhanced Image Navigation Dots */}
            {bannerImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {bannerImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageNavigation(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 hover:scale-125 ${
                      currentImageIndex === index 
                        ? "bg-white shadow-lg" 
                        : "bg-white/60 hover:bg-white/80"
                    }`}
                  />
                ))}
              </div>
            )}
            
            {/* Primary image indicator */}
            {currentImageIndex === 0 && (
              <div className="absolute top-4 right-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                الصورة الرئيسية
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="p-4 mb-24">
        {products.length === 0 ? (
          <div className="text-center py-12" style={{ color: storeSettings.menuTextColor }}>
            <div className="flex flex-col items-center space-y-4">
              <div className="text-6xl">🍽️</div>
              <h3 className="text-xl font-bold">لا توجد منتجات بعد</h3>
              <p className="text-gray-500">ابدأ بإضافة وجباتك من قسم البناء</p>
              <Link to="/add-product">
                <Button style={{ backgroundColor: storeSettings.menuAccentColor }} className="hover:opacity-90">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة أول وجبة
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-102"
                style={{ backgroundColor: storeSettings.menuBackgroundColor === "#ffffff" ? "#ffffff" : `${storeSettings.menuBackgroundColor}f0` }}
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="flex flex-col h-full">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                  
                  <div className="p-4 text-right flex-1 flex flex-col">
                    <h3 className="text-lg font-bold mb-3 line-clamp-2" style={{ color: storeSettings.menuTextColor }}>
                      {product.name}
                    </h3>
                    
                    <div className="mt-auto">
                      <span className="font-bold text-xl block mb-4" style={{ color: storeSettings.menuAccentColor }}>
                        {product.price.toLocaleString()} د.ع
                      </span>
                      
                      <div className="flex flex-col gap-2">
                        <Button 
                          size="sm"
                          className="text-sm h-9 w-full hover:opacity-90 transition-all duration-200"
                          style={{ backgroundColor: storeSettings.menuAccentColor }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(product);
                          }}
                        >
                          أضف للسلة
                        </Button>
                        
                        <Button 
                          size="sm"
                          variant="outline"
                          className="text-sm h-9 w-full hover:opacity-80 transition-all duration-200"
                          style={{ 
                            borderColor: storeSettings.menuAccentColor, 
                            color: storeSettings.menuTextColor 
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewProduct(product.id);
                          }}
                        >
                          التفاصيل
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shopping Cart Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <Link to="/checkout">
          <div className="h-16 flex items-center justify-center relative rounded-t-3xl transition-all duration-300 hover:shadow-lg" style={{ backgroundColor: storeSettings.menuAccentColor }}>
            <div className="absolute -top-6 rounded-full p-4 border-4 border-white shadow-lg transition-transform duration-200 hover:scale-110" style={{ backgroundColor: storeSettings.menuAccentColor }}>
              <ShoppingCart className="w-6 h-6 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse" style={{ color: storeSettings.menuAccentColor }}>
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
