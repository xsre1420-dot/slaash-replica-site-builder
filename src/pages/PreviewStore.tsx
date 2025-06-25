
import { X, ShoppingCart } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { categories, getProductsByCategory } from "@/data/dummyData";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PreviewStore = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
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
      <div className="flex justify-end gap-2 p-4 overflow-x-auto">
        {categories.map((category) => (
          <button 
            key={category.id}
            className={`px-4 py-2 rounded-full text-dark-green ${
              selectedCategory === category.id 
                ? "bg-primary text-white" 
                : "bg-white text-dark-green"
            }`}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Products List */}
      <div className="p-4 space-y-4 mb-24">
        {products.length === 0 ? (
          <div className="text-center py-8 text-dark-green">
            لا توجد منتجات في هذا التصنيف
          </div>
        ) : (
          products.map((product) => (
            <div 
              key={product.id} 
              className="bg-white rounded-xl p-4 shadow-sm"
              onClick={() => handleViewProduct(product.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col items-end text-right flex-1">
                  <h3 className="text-xl font-bold mb-1 text-dark-green">{product.name}</h3>
                  <p className="text-dark-green text-sm mb-2 line-clamp-2">{product.description}</p>
                  <span className="text-primary font-bold">{product.price.toLocaleString()} د.ع</span>
                  <Badge className="mt-2 bg-teal-100 text-primary hover:bg-teal-100">
                    {categories.find(c => c.id === product.category)?.name || product.category}
                  </Badge>
                  
                  <div className="flex gap-2 mt-4">
                    <Button 
                      className="bg-primary hover:bg-primary/90"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                    >
                      أضف إلى السلة
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="text-dark-green border-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewProduct(product.id);
                      }}
                    >
                      التفاصيل
                    </Button>
                  </div>
                </div>
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-24 h-24 rounded-lg object-cover ml-4"
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Shopping Cart Bar with Rounded Edges */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <Link to="/checkout">
          <div className="bg-primary h-16 flex items-center justify-center relative rounded-t-3xl">
            {/* Primary circular icon in the center */}
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
