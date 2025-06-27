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
  const [headerImages, setHeaderImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { addToCart, cartCount } = useCart();
  const { storeName, storeLogo } = useStore();
  const navigate = useNavigate();

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

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setHeaderImages([...headerImages, imageUrl]);
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    const newImages = headerImages.filter((_, i) => i !== index);
    setHeaderImages(newImages);
    if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(0);
    }
  };

  // Auto-rotate images every 5 seconds
  useEffect(() => {
    if (headerImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % headerImages.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [headerImages.length]);

  return (
    <div className="min-h-screen bg-primary-custom">
      {/* Header */}
      <div className="bg-primary text-primary-custom p-4 rounded-b-3xl">
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

      {/* Category Tabs - Moved to top */}
      <div className="flex justify-end gap-2 p-4 overflow-x-auto bg-primary-custom shadow-sm">
        {categories.map((category) => (
          <button 
            key={category.id}
            className={`px-4 py-2 rounded-full text-dark-green whitespace-nowrap ${
              selectedCategory === category.id 
                ? "bg-primary text-primary-custom" 
                : "bg-gray-100 text-dark-green hover:bg-gray-200"
            }`}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Header Images Section - Only show if images exist */}
      {headerImages.length > 0 && (
        <div className="relative">
          <div className="relative h-56 overflow-hidden">
            <img
              src={headerImages[currentImageIndex]}
              alt="Header"
              className="w-full h-full object-cover"
            />
            
            {/* Image Navigation Dots */}
            {headerImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {headerImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      currentImageIndex === index ? "bg-white" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Image Management Buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button size="sm" className="bg-primary/80 hover:bg-primary">
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة صورة
                </Button>
              </label>
              
              {headerImages.length > 1 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeImage(currentImageIndex)}
                  className="bg-primary/80 hover:bg-primary"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Header Image Button - Show when no images */}
      {headerImages.length === 0 && (
        <div className="p-4 bg-primary-custom border-b">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-custom">
              <Plus className="w-4 h-4 ml-2" />
              إضافة صورة للرأس
            </Button>
          </label>
        </div>
      )}

      {/* Products Grid - Updated design */}
      <div className="p-4 mb-24">
        {products.length === 0 ? (
          <div className="text-center py-12 text-dark-green">
            <div className="flex flex-col items-center space-y-4">
              <div className="text-6xl">🍽️</div>
              <h3 className="text-xl font-bold">لا توجد منتجات بعد</h3>
              <p className="text-gray-500">ابدأ بإضافة وجباتك من قسم البناء</p>
              <Link to="/add-product">
                <Button className="bg-primary hover:bg-primary/90 text-primary-custom">
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
                className="bg-primary-custom rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="flex flex-col h-full">
                  {/* Full width image without borders */}
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-40 object-cover"
                  />
                  
                  {/* Product info - simplified */}
                  <div className="p-4 text-right flex-1 flex flex-col">
                    <h3 className="text-lg font-bold mb-3 text-dark-green line-clamp-2">{product.name}</h3>
                    
                    <div className="mt-auto">
                      <span className="text-primary font-bold text-xl block mb-4">{product.price.toLocaleString()} د.ع</span>
                      
                      <div className="flex flex-col gap-2">
                        <Button 
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-sm h-9 w-full text-primary-custom"
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
                          className="text-dark-green border-primary hover:bg-primary/10 text-sm h-9 w-full"
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

      {/* Shopping Cart Bar with Rounded Edges */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <Link to="/checkout">
          <div className="bg-primary h-16 flex items-center justify-center relative rounded-t-3xl">
            {/* Primary circular icon in the center */}
            <div className="absolute -top-6 bg-primary rounded-full p-4 border-4 border-primary-custom shadow-lg">
              <ShoppingCart className="w-6 h-6 text-primary-custom" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary-custom text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
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
