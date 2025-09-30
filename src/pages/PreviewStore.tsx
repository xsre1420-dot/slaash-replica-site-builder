import { X, ShoppingCart, Plus, Trash2, Search, Heart, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getProductsByCategory, getCategories, loadProducts } from "@/data/dummyData";
import { Product, Category } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import MetaPixel from "@/components/MetaPixel";
import { useMetaPixel } from "@/hooks/useMetaPixel";

const PreviewStore = () => {
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
        console.log('PreviewStore: تحميل الفئات من Supabase...');
        const categoriesData = await getCategories();
        console.log('PreviewStore: تم تحميل', categoriesData.length, 'فئة');
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
      console.log('PreviewStore: إعادة تحميل الفئات عند التركيز على النافذة');
      loadCategoriesData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Only use banner images from settings (no automatic promotional banner)
  const bannerImages = storeSettings.bannerImages || [];

  // Load products from Supabase and update when categories change
  useEffect(() => {
    const loadProductsData = async () => {
      await loadProducts();
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
      className="min-h-screen bg-white"
    >
      {/* Meta Pixel Integration */}
      <MetaPixel />
      
      {/* Header with Logo and Store Name */}
      <div className="bg-white sticky top-0 z-40 border-b border-gray-100">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            {/* Left: Store Logo + Name */}
            <div className="flex items-center gap-2">
              {storeLogo && (
                <img src={storeLogo} alt={storeName} className="w-10 h-10 rounded-full object-cover" />
              )}
              <div className="flex items-center gap-1">
                <span className="font-bold text-gray-900 text-base">{storeName}</span>
                <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
              </div>
            </div>
            
            {/* Right: Currency and Search */}
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1 text-sm font-medium text-gray-700">
                <span>IQD</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <Search className="w-5 h-5 text-gray-700" />
            </div>
          </div>
        </div>
        
        {/* Categories Row */}
        <div className="flex gap-6 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {categories.map((category) => (
            <button 
              key={category.id}
              className={`whitespace-nowrap text-sm font-medium transition-all duration-200 ${
                selectedCategory === category.id 
                  ? "text-gray-900" 
                  : "text-gray-400"
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Banner */}
      {bannerImages.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <div 
            className="relative h-44 overflow-hidden rounded-3xl cursor-pointer"
            onMouseEnter={handleImageHover}
          >
            <img
              src={bannerImages[currentImageIndex]}
              alt="Store Banner"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            
            {bannerImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
                {bannerImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageNavigation(index)}
                    className={`transition-all duration-200 rounded-full ${
                      currentImageIndex === index 
                        ? "bg-white w-6 h-2" 
                        : "bg-white/60 w-2 h-2"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products Count and Sort */}
      <div className="flex justify-between items-center px-4 py-4 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-900">{products.length} منتجات</span>
        <button className="flex items-center gap-1 text-sm text-gray-600">
          <span>الافتراضي</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4 4 4-4" />
          </svg>
        </button>
      </div>

      {/* Clean Products Grid */}
      <div className="px-4 pb-28">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <div className="text-4xl">🛍️</div>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-900">
              لا توجد منتجات بعد
            </h3>
            <p className="text-gray-500 mb-6">ابدأ بإضافة منتجاتك من قسم البناء</p>
            <Link to="/add-product">
              <Button className="rounded-full px-8">
                <Plus className="w-4 h-4 ml-2" />
                إضافة أول منتج
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewProduct(product.id)}
              >
                <div className="relative bg-gray-100 aspect-square">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain p-4"
                    loading="lazy"
                  />
                </div>
                
                <div className="p-3">
                  <div className="text-sm font-medium text-gray-900 mb-1 text-right line-clamp-2">
                    {product.name}
                  </div>
                  <div className="text-sm font-bold text-gray-900 text-right">
                    IQD {product.price.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Horizontal Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <Link to="/checkout">
            <div className="bg-black rounded-3xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <ShoppingCart className="w-6 h-6 text-white" />
                    <span className="absolute -top-2 -right-2 bg-yellow-400 text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      {cartCount}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-gray-400">المبلغ الكلي</div>
                    <div className="text-base font-bold text-white">
                      IQD {cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-yellow-400 font-bold text-base">
                  <span>عرض السلة</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};

export default PreviewStore;
