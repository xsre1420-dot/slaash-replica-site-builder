import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Package, AlertTriangle, CheckCircle, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  created_at: string;
}

function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [minStockLevel, setMinStockLevel] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error("خطأ في تحميل المنتجات");
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (productId: string, quantity: number, minLevel?: number) => {
    try {
      const updateData: any = { stock_quantity: quantity };
      if (minLevel !== undefined) {
        updateData.min_stock_level = minLevel;
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (error) throw error;
      
      toast.success("تم تحديث المخزون بنجاح");
      fetchProducts();
      setSelectedProduct(null);
      setNewQuantity("");
      setMinStockLevel("");
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error("خطأ في تحديث المخزون");
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (product: Product) => {
    const quantity = product.stock_quantity || 0;
    const minLevel = product.min_stock_level || 5;
    
    if (quantity === 0) return { status: 'out', label: 'نفد المخزون', color: 'bg-red-100 text-red-800' };
    if (quantity <= minLevel) return { status: 'low', label: 'مخزون منخفض', color: 'bg-yellow-100 text-yellow-800' };
    return { status: 'good', label: 'متوفر', color: 'bg-green-100 text-green-800' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">جاري تحميل المخزون...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/builder">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 ml-2" />
                  العودة
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">إدارة المخزون</h1>
                <p className="text-gray-600">تتبع وإدارة مخزون المنتجات</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search and Stats */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="البحث في المنتجات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-lg"
              />
            </div>
          </div>

          {/* Stock Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">إجمالي المنتجات</p>
                    <p className="text-2xl font-bold text-gray-900">{products.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">متوفر</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {products.filter(p => getStockStatus(p).status === 'good').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">مخزون منخفض</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {products.filter(p => getStockStatus(p).status === 'low').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">نفد المخزون</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {products.filter(p => getStockStatus(p).status === 'out').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Products List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              قائمة المنتجات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">لا توجد منتجات في المخزون</p>
                <Link to="/add-product">
                  <Button className="mt-4">إضافة منتج جديد</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product);
                  return (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">{product.name}</h3>
                          <p className="text-sm text-gray-600">{product.category}</p>
                          <p className="text-sm font-medium text-gray-900">{product.price} ر.س</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">الكمية</p>
                          <p className="text-lg font-bold text-gray-900">
                            {product.stock_quantity || 0}
                          </p>
                        </div>
                        
                        <Badge className={stockStatus.color}>
                          {stockStatus.label}
                        </Badge>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(product);
                                setNewQuantity(String(product.stock_quantity || 0));
                                setMinStockLevel(String(product.min_stock_level || 5));
                              }}
                            >
                              <Edit className="w-4 h-4 ml-2" />
                              تحديث
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>تحديث مخزون {selectedProduct?.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="quantity">الكمية الحالية</Label>
                                <Input
                                  id="quantity"
                                  type="number"
                                  value={newQuantity}
                                  onChange={(e) => setNewQuantity(e.target.value)}
                                  min="0"
                                />
                              </div>
                              <div>
                                <Label htmlFor="minLevel">الحد الأدنى للمخزون</Label>
                                <Input
                                  id="minLevel"
                                  type="number"
                                  value={minStockLevel}
                                  onChange={(e) => setMinStockLevel(e.target.value)}
                                  min="0"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    if (selectedProduct) {
                                      updateStock(
                                        selectedProduct.id,
                                        parseInt(newQuantity) || 0,
                                        parseInt(minStockLevel) || 5
                                      );
                                    }
                                  }}
                                  className="flex-1"
                                >
                                  حفظ التغييرات
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Export the component as default
export default Inventory;