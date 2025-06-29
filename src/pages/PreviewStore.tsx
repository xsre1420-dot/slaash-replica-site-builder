
import { useState, useEffect } from "react";
import { ArrowLeft, ShoppingCart, Plus, Minus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { products as initialProducts, categories as initialCategories } from "@/data/dummyData";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";

export default function PreviewStore() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products] = useState<Product[]>(initialProducts);
  const [categories] = useState<Category[]>(initialCategories);
  const [currentImageIndex, setCurrentImageIndex] = useState<{ [key: string]: number }>({});
  const { addToCart, cartItems } = useCart();
  const { storeName, storeSettings } = useStore();
  const navigate = useNavigate();

  const filteredProducts = selectedCategory === "all" 
    ? products 
    : products.filter(product => product.category === selectedCategory);

  const getCartItemCount = (productId: string) => {
    const item = cartItems.find(item => item.product.id === productId);
    return item ? item.quantity : 0;
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product);
  };

  const nextImage = (productId: string, images: string[]) => {
    setCurrentImageIndex(prev => ({
      ...prev,
      [productId]: ((prev[productId] || 0) + 1) % images.length
    }));
  };

  const prevImage = (productId: string, images: string[]) => {
    setCurrentImageIndex(prev => ({
      ...prev,
      [productId]: prev[productId] === 0 || !prev[productId] 
        ? images.length - 1 
        : prev[productId] - 1
    }));
  };

  const totalItemsInCart = cartItems.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    const interval = setInterval(() => {
      products.forEach(product => {
        if (product.additionalImages && product.additionalImages.length > 1) {
          const allImages = [product.image, ...product.additionalImages].filter(Boolean);
          if (allImages.length > 1) {
            nextImage(product.id, allImages);
          }
        }
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [products]);

  return (
    <div 
      className="min-h-screen font-arabic"
      style={{ 
        backgroundColor: storeSettings.menuBackgroundColor,
        color: storeSettings.menuTextColor 
      }}
    >
      {/* Header - Show only store name */}
      <div className="bg-black/90 backdrop-blur-md sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 text-white hover:bg-white/10 rounded-xl">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            
            {/* Only show store name */}
            <h1 className="text-2xl font-bold text-white font-serif">{storeName}</h1>
            
            <Link to="/checkout">
              <Button variant="ghost" className="relative p-2 text-white hover:bg-white/10 rounded-xl">
                <ShoppingCart className="w-6 h-6" />
                {totalItemsInCart > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-orange-500 text-white min-w-[20px] h-5 rounded-full text-xs flex items-center justify-center">
                    {totalItemsInCart}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Primary Banner */}
        {storeSettings.bannerImages && storeSettings.bannerImages.length > 0 && (
          <div className="mb-8 rounded-3xl overflow-hidden shadow-modern-lg">
            <img 
              src={storeSettings.bannerImages[storeSettings.primaryBannerIndex] || storeSettings.bannerImages[0]} 
              alt="صورة رئيسية للمتجر"
              className="w-full h-64 object-cover"
            />
          </div>
        )}

        {/* Categories */}
        <div className="mb-8">
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
              className={`whitespace-nowrap rounded-2xl transition-all duration-300 ${
                selectedCategory === "all" 
                  ? "bg-black text-white shadow-lg scale-105" 
                  : "bg-white/80 backdrop-blur-sm hover:bg-white border-gray-200"
              }`}
            >
              الكل
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={`whitespace-nowrap rounded-2xl transition-all duration-300 ${
                  selectedCategory === category.id 
                    ? "bg-black text-white shadow-lg scale-105" 
                    : "bg-white/80 backdrop-blur-sm hover:bg-white border-gray-200"
                }`}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const allImages = product.additionalImages && product.additionalImages.length > 0 
              ? [product.image, ...product.additionalImages].filter(Boolean)
              : [product.image].filter(Boolean);
            
            const currentIndex = currentImageIndex[product.id] || 0;
            const displayImage = allImages[currentIndex] || product.image;
            const cartCount = getCartItemCount(product.id);

            return (
              <Card 
                key={product.id} 
                className="group cursor-pointer bg-white/90 backdrop-blur-sm border-0 rounded-3xl shadow-modern hover:shadow-modern-lg transition-all duration-500 hover:scale-[1.02] overflow-hidden"
                onClick={() => navigate(`/product-details/${product.id}`)}
              >
                <div className="relative overflow-hidden rounded-t-3xl">
                  {displayImage && (
                    <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100">
                      <img
                        src={displayImage}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      
                      {/* Image Navigation Dots */}
                      {allImages.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2">
                          <div className="flex gap-1">
                            {allImages.map((_, index) => (
                              <div
                                key={index}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                  index === currentIndex 
                                    ? 'bg-white shadow-lg' 
                                    : 'bg-white/50'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  )}
                </div>
                
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 text-right">
                        <h3 
                          className="text-xl font-bold mb-2 group-hover:text-orange-600 transition-colors duration-300"
                          style={{ color: storeSettings.menuTextColor }}
                        >
                          {product.name}
                        </h3>
                        {product.description && (
                          <p 
                            className="text-sm leading-relaxed opacity-75"
                            style={{ color: storeSettings.menuTextColor }}
                          >
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        {cartCount > 0 ? (
                          <div className="flex items-center gap-2 bg-orange-50 rounded-2xl px-3 py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-orange-100 rounded-xl"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Remove from cart logic here
                              }}
                            >
                              <Minus className="h-4 w-4 text-orange-600" />
                            </Button>
                            <span className="font-medium text-orange-600 min-w-[20px] text-center">
                              {cartCount}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-orange-100 rounded-xl"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(product);
                              }}
                            >
                              <Plus className="h-4 w-4 text-orange-600" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-2xl px-6 shadow-lg hover:shadow-xl transition-all duration-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
                          >
                            <Plus className="w-4 h-4 ml-1" />
                            إضافة
                          </Button>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div 
                          className="text-2xl font-bold"
                          style={{ color: storeSettings.menuAccentColor || '#000' }}
                        >
                          {product.price} ر.س
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: storeSettings.menuTextColor }}>
              لا توجد منتجات في هذا التصنيف
            </h3>
            <p className="opacity-75" style={{ color: storeSettings.menuTextColor }}>
              جرب تصنيف آخر أو تصفح جميع المنتجات
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
