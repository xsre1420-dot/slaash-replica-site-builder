
import { Button } from "@/components/ui/button";
import { Edit, Plus, Trash2, Star, Heart, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { loadProducts, deleteProduct } from "@/data/dummyData";
import { Product } from "@/types";


interface ProductsListProps {
  onProductSelect?: (product: {id: string, name: string}) => void;
}

export const ProductsList = ({ onProductSelect }: ProductsListProps = {}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    // Load products from Supabase
    const loadProductsData = async () => {
      console.log('تحميل المنتجات من Supabase...');
      const productsData = await loadProducts();
      console.log('تم تحميل المنتجات:', productsData.length, 'منتج');
      setProducts(productsData);
    };
    loadProductsData();

    // Refresh products when window gains focus
    const handleFocus = () => {
      console.log('إعادة تحميل المنتجات عند التركيز على النافذة');
      loadProductsData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleDelete = async (id: string) => {
    const result = await deleteProduct(id);
    if (result.success) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
          <div className="text-4xl">🍽️</div>
        </div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد منتجات مسجلة</h3>
        <p className="text-gray-500 mb-6">يمكنك البدء بإضافة منتجات جديدة</p>
        <Link to="/add-product">
          <Button 
            className="text-white rounded-full px-8 border-0 shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة منتج جديد
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <div 
          key={product.id} 
          className={`bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
            onProductSelect ? 'cursor-pointer' : ''
          }`}
          onClick={onProductSelect ? () => onProductSelect({id: product.id, name: product.name}) : undefined}
        >
          <div className="relative overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-56 object-cover"
              loading="lazy"
            />
            <button
              className={`absolute top-4 left-4 w-12 h-12 rounded-xl shadow-md flex items-center justify-center transition-all duration-300 ${
                favorites.includes(product.id) 
                  ? 'bg-red-500 text-white scale-105' 
                  : 'bg-white/90 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:scale-105'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(product.id);
              }}
            >
              <Heart className={`w-6 h-6 ${favorites.includes(product.id) ? 'fill-current' : ''}`} />
            </button>
            
            {/* Action buttons */}
            <div className="absolute top-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Link to={`/edit-product/${product.id}`}>
                <Button 
                  size="sm"
                  className="w-12 h-12 p-0 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 hover:text-blue-600 rounded-xl shadow-md hover:scale-105 transition-all duration-300"
                >
                  <Edit className="w-5 h-5" />
                </Button>
              </Link>
              <Button 
                size="sm"
                className="w-12 h-12 p-0 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 hover:text-red-600 rounded-xl shadow-md hover:scale-105 transition-all duration-300"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(product.id);
                }}
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-base font-semibold text-gray-700">4.5</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 text-right">{product.name}</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-4 text-right line-clamp-2">{product.description}</p>
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex flex-col items-start">
                <span className="text-2xl font-bold text-gray-800">{product.price.toLocaleString()} د.ع</span>
                {product.stockQuantity !== undefined && (
                  <span className="text-sm text-gray-600 mt-1.5 font-medium">الكمية: {product.stockQuantity}</span>
                )}
                {product.cost && (
                  <span className="text-xs text-gray-500 mt-1">التكلفة: {product.cost.toLocaleString()} د.ع</span>
                )}
              </div>
              <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                {onProductSelect && (
                  <Button 
                    size="lg" 
                    className="rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 px-5 py-2.5"
                    onClick={() => onProductSelect({id: product.id, name: product.name})}
                  >
                    <MessageSquare className="w-5 h-5 ml-2" />
                    <span className="font-semibold">التعليقات</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Colors and Sizes Info */}
            {(product.colors || product.sizes) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {product.colors && product.colors.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">الألوان:</span>
                    <div className="flex gap-1">
                      {product.colors.slice(0, 3).map((color, index) => (
                        <div
                          key={index}
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: color.value }}
                        />
                      ))}
                      {product.colors.length > 3 && (
                        <span className="text-xs text-gray-500">+{product.colors.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}
                {product.sizes && product.sizes.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">القياسات:</span>
                    <div className="flex gap-1">
                      {product.sizes.slice(0, 3).map((size, index) => (
                        <span key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {size}
                        </span>
                      ))}
                      {product.sizes.length > 3 && (
                        <span className="text-xs text-gray-500">+{product.sizes.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
