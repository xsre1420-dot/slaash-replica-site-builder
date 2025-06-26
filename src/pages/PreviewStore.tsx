import { X, ShoppingCart, Plus, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { categories, getProductsByCategory } from "@/data/dummyData";
import { Product } from "@/types";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import HeaderImagesManager from "@/components/preview/HeaderImagesManager";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Store Header */}
      <div className="bg-white text-black p-4 border-b-2 border-primary">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <Link to="/builder" className="text-primary hover:text-primary/80">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div className="flex items-center gap-3">
              {storeLogo && (
                <img src={storeLogo} alt={storeName} className="w-10 h-10 rounded-full object-cover" />
              )}
              <h1 className="text-xl font-bold text-black">{storeName}</h1>
            </div>
            <div className="w-6"></div>
          </div>
        </div>
      </div>

      {/* Header Images Manager */}
      <div className="bg-white border-b-2 border-primary">
        <div className="max-w-6xl mx-auto p-4">
          <HeaderImagesManager />
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto p-4">
        {/* Categories Filter */}
        <Card className="mb-6 shadow-lg border-2 border-primary bg-white">
          <CardHeader>
            <CardTitle className="text-black text-right">الأصناف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`whitespace-nowrap ${
                    selectedCategory === category.id 
                      ? "bg-primary text-white hover:bg-primary/90" 
                      : "text-black border-primary hover:bg-primary/10"
                  }`}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <Card className="shadow-lg border-2 border-primary bg-white">
          <CardHeader>
            <CardTitle className="text-black text-right">المنيو</CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">لا توجد منتجات متاحة</p>
                <p className="text-gray-500 text-sm mt-2">قم بإضافة منتجات من لوحة التحكم</p>
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-4 bg-white border-2 border-primary rounded-lg hover:shadow-md transition-shadow">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                      <div className="flex-grow text-right">
                        <h3 className="font-bold text-lg text-black mb-1">{product.name}</h3>
                        <p className="text-gray-600 text-sm mb-2 line-clamp-2">{product.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-primary font-bold text-lg">
                            {product.price.toLocaleString()} د.ع
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {product.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PreviewStore;
