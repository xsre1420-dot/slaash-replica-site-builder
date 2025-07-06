
import { Button } from "@/components/ui/button";
import { Edit, Plus, Trash2, Star, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { products as initialProducts, reloadProducts } from "@/data/dummyData";
import { Product } from "@/types";


export const ProductsList = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    // Reload products from localStorage to get the latest data
    reloadProducts();
    setProducts(initialProducts);
  }, []);

  const handleDelete = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
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
        <div key={product.id} className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="relative">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-48 object-cover"
            />
            <button
              className={`absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                favorites.includes(product.id) 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white/80 text-gray-400 hover:text-red-500'
              }`}
              onClick={() => toggleFavorite(product.id)}
            >
              <Heart className={`w-5 h-5 ${favorites.includes(product.id) ? 'fill-current' : ''}`} />
            </button>
            
            {/* Action buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              <Link to={`/edit-product/${product.id}`}>
                <Button 
                  size="sm"
                  className="w-10 h-10 p-0 bg-white/80 hover:bg-white text-gray-600 hover:text-blue-600 rounded-full"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
              <Button 
                size="sm"
                className="w-10 h-10 p-0 bg-white/80 hover:bg-white text-gray-600 hover:text-red-600 rounded-full"
                onClick={() => handleDelete(product.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm text-gray-600">4.5</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 text-right">{product.name}</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-4 text-right line-clamp-2">{product.description}</p>
            
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-gray-800">{product.price.toLocaleString()} د.ع</span>
              <div className="flex gap-2">
                <Link to={`/edit-product/${product.id}`}>
                  <Button size="sm" variant="outline" className="rounded-full">
                    تعديل
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
