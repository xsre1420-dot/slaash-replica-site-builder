import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Minus, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getProducts, updateProduct } from "@/lib/products";
import { toast } from "sonner";
import StoreHeader from "@/components/StoreHeader";
import { useStore } from "@/context/StoreContext";

interface ProductWithStock extends DatabaseProduct {
  stock?: number;
}

interface DatabaseProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  additional_images?: string[];
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export default function Inventory() {
  const { user } = useAuth();
  const { storeName, storeLogo, updateStore } = useStore();
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductWithStock[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, [user]);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, products]);

  const loadInventory = async () => {
    if (!user?.id) return;
    
    try {
      const result = await getProducts(user.id);
      if (result.data) {
        // Add random stock numbers for demo - in real app this would come from database
        const productsWithStock = result.data.map(product => ({
          ...product,
          stock: Math.floor(Math.random() * 100) + 1
        }));
        setProducts(productsWithStock);
      }
    } catch (error) {
      toast.error("حدث خطأ في جلب بيانات المخزون");
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  };

  const updateStock = async (productId: string, newStock: number) => {
    if (newStock < 0) return;
    
    setProducts(prev => prev.map(product => 
      product.id === productId 
        ? { ...product, stock: newStock }
        : product
    ));
    
    toast.success("تم تحديث المخزون بنجاح");
  };

  const getStockStatus = (stock?: number) => {
    if (!stock || stock === 0) return { status: 'نفد المخزون', color: 'bg-red-500', icon: AlertTriangle };
    if (stock < 10) return { status: 'مخزون منخفض', color: 'bg-yellow-500', icon: AlertTriangle };
    return { status: 'متوفر', color: 'bg-green-500', icon: CheckCircle };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 font-arabic flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-gray-600">جاري تحميل بيانات المخزون...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Store Header */}
      <div className="bg-white shadow-sm">
        <StoreHeader 
          storeName={storeName} 
          storeLogo={storeLogo} 
          onUpdateStore={updateStore} 
        />
      </div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">إدارة المخزون</h1>
              <p className="text-gray-600">متابعة وإدارة مخزون المنتجات</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                إجمالي المنتجات: {products.length}
              </Badge>
              <Badge variant="outline" className="text-sm">
                نفد المخزون: {products.filter(p => !p.stock || p.stock === 0).length}
              </Badge>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <Input
              placeholder="البحث في المنتجات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 sm:pr-12 rounded-xl border-gray-200"
            />
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                {searchQuery ? "لا توجد منتجات تطابق البحث" : "لا توجد منتجات في المخزون"}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery ? "جرب البحث بكلمات مختلفة" : "ابدأ بإضافة منتجات جديدة"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product.stock);
              const StatusIcon = stockStatus.icon;

              return (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-all duration-300">
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={product.image_url || '/placeholder.svg'}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3">
                      <Badge className={`${stockStatus.color} text-white text-xs`}>
                        <StatusIcon className="w-3 h-3 ml-1" />
                        {stockStatus.status}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base">
                        {product.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 mb-2">{product.category}</p>
                      <p className="text-lg sm:text-xl font-bold text-primary">
                        {product.price.toFixed(2)} ريال
                      </p>
                    </div>

                    {/* Stock Management */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">الكمية المتوفرة</span>
                        <span className="text-lg font-bold text-gray-800">{product.stock || 0}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStock(product.id, (product.stock || 0) - 1)}
                          disabled={!product.stock || product.stock === 0}
                          className="w-8 h-8 p-0 rounded-lg"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        
                        <Input
                          type="number"
                          value={product.stock || 0}
                          onChange={(e) => updateStock(product.id, parseInt(e.target.value) || 0)}
                          className="text-center text-sm h-8"
                          min="0"
                        />
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStock(product.id, (product.stock || 0) + 1)}
                          className="w-8 h-8 p-0 rounded-lg"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}