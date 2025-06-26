
import { X, ShoppingCart, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { categories, getProductsByCategory } from "@/data/dummyData";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import HeaderImagesManager from "@/components/preview/HeaderImagesManager";

const PreviewStore = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const { addToCart, cartCount } = useCart();
  const { storeName, storeLogo } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    setProducts(getProductsByCategory(selectedCategory));
  }, [selectedCategory]);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
  };

  const handleViewProduct = (productId: string) => {
    navigate(`/product-details/${productId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white p-4 rounded-b-3xl">
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
      <div className="flex justify-end gap-2 p-4 overflow-x-auto bg-white shadow-sm">
        {categories.map((category) => (
          <button 
            key={category.id}
            className={`px-4 py-2 rounded-full text-dark-green whitespace-nowrap transition-colors ${
              selectedCategory === category.id 
                ? "bg-primary text-white" 
                : "bg-gray-100 text-dark-green hover:bg-gray-200"
            }`}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Header Images Section */}
      <HeaderImagesManager />

      {/* Products Grid */}
      <div className="p-4 mb-24">
        {products.length === 0 ? (
          <div className="text-center py-12 text-dark-green">
            <div className="flex flex-col items-center space-y-4">
              <div className="text-6xl">🍽️</div>
              <h3 className="text-xl font-bold">لا توجد منتجات بعد</h3>
              <p className="text-gray-500">ابدأ بإضافة وجباتك من قسم البناء</p>
              <Link to="/add-product">
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة أول وجبة
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer border"
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="flex h-32">
                  {/* Product Image - Left side */}
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-32 h-32 object-cover flex-shrink-0"
                  />
                  
                  {/* Product Info - Right side */}
                  <div className="flex-1 p-4 text-right flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold mb-2 text-dark-green line-clamp-2">{product.name}</h3>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-sm h-8"
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
                          className="text-dark-green border-primary hover:bg-primary/10 text-sm h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewProduct(product.id);
                          }}
                        >
                          التفاصيل
                        </Button>
                      </div>
                      
                      <span className="text-primary font-bold text-lg">{product.price.toLocaleString()} د.ع</span>
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
          <div className="bg-primary h-16 flex items-center justify-center relative rounded-t-3xl">
            <div className="absolute -top-6 bg-primary rounded-full p-4 border-4 border-white shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
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
