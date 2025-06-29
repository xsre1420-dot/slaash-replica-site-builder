
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
      className="min-h-screen font-arabic bg-gray-50"
      style={{ 
        backgroundColor: storeSettings.menuBackgroundColor || '#f9fafb',
        color: storeSettings.menuTextColor 
      }}
    >
      {/* Header - White background with clean design */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 text-gray-700 hover:bg-gray-100 rounded-xl">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            
            {/* Store name only */}
            <h1 className="text-2xl font-bold text-gray-800 font-serif">{storeName}</h1>
            
            <Link to="/checkout">
              <Button variant="ghost" className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-xl">
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
          <div className="mb-8 rounded-3xl overflow-hidden shadow-lg">
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
              className={`whitespace-nowrap rounded-full px-6 py-2 transition-all duration-300 ${
                selectedCategory === "all" 
                  ? "bg-gray-800 text-white shadow-md" 
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              الكل
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={`whitespace-nowrap rounded-full px-6 py-2 transition-all duration-300 ${
                  selectedCategory === category.id 
                    ? "bg-gray-800 text-white shadow-md" 
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
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
                className="group cursor-pointer bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] overflow-hidden"
                onClick={() => navigate(`/product-details/${product.id}`)}
              >
                <div className="relative overflow-hidden rounded-t-2xl">
                  {displayImage && (
                    <div className="relative h-48 bg-gray-100">
                      <img
                        src={displayImage}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                      
                      {/* Heart icon for favorites */}
                      <div className="absolute top-3 right-3">
                        <div className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </div>
                      </div>
                      
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
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 text-right">
                        <h3 className="text-lg font-semibold text-gray-800 mb-1 group-hover:text-orange-600 transition-colors duration-300">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-sm text-gray-500 leading-relaxed">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3">
                      <div className="flex items-center gap-2">
                        {cartCount > 0 ? (
                          <div className="flex items-center gap-2 bg-orange-50 rounded-full px-3 py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-orange-100 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Remove from cart logic here
                              }}
                            >
                              <Minus className="h-3 w-3 text-orange-600" />
                            </Button>
                            <span className="font-medium text-orange-600 min-w-[16px] text-center text-sm">
                              {cartCount}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-orange-100 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(product);
                              }}
                            >
                              <Plus className="h-3 w-3 text-orange-600" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gray-800 hover:bg-gray-900 text-white rounded-full px-4 py-2 text-sm transition-all duration-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
                          >
                            <Plus className="w-3 h-3 ml-1" />
                            إضافة
                          </Button>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-800">
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
            <h3 className="text-2xl font-bold mb-2 text-gray-800">
              لا توجد منتجات في هذا التصنيف
            </h3>
            <p className="text-gray-500">
              جرب تصنيف آخر أو تصفح جميع المنتجات
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
