import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category: string;
}

interface SuggestedProduct {
  id: string;
  suggested_product_id: string;
  display_order: number;
  product: Product;
}

interface SuggestedProductsManagerProps {
  productId: string;
  productName: string;
}

const SuggestedProductsManager = ({ productId, productName }: SuggestedProductsManagerProps) => {
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedProduct[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && productId) {
      fetchSuggestedProducts();
      fetchAvailableProducts();
      fetchCategories();
    }
  }, [user, productId]);

  const fetchSuggestedProducts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // First get suggested products
      const { data: suggestedData, error: suggestedError } = await (supabase as any)
        .from('suggested_products')
        .select('id, suggested_product_id')
        .eq('product_id', productId)
        .eq('owner_id', user.id)
        .limit(20);

      if (suggestedError) throw suggestedError;
      
      if (suggestedData && suggestedData.length > 0) {
        // Get product details for each suggested product
        const productIds = suggestedData.map(sp => sp.suggested_product_id);
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name, price, image_url, category')
          .in('id', productIds)
          .eq('owner_id', user.id);

        if (productsError) throw productsError;

        // Combine the data
        const combinedData = suggestedData.map(sp => ({
          ...sp,
          product: productsData?.find(p => p.id === sp.suggested_product_id) || {
            id: sp.suggested_product_id,
            name: 'منتج محذوف',
            price: 0,
            image_url: '',
            category: ''
          }
        }));

        setSuggestedProducts(combinedData);
      } else {
        setSuggestedProducts([]);
      }
    } catch (error) {
      console.error('Error fetching suggested products:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في تحميل المنتجات المقترحة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, category')
        .eq('owner_id', user.id)
        .neq('id', productId);

      if (error) throw error;
      setAvailableProducts(data || []);
    } catch (error) {
      console.error('Error fetching available products:', error);
    }
  };

  const fetchCategories = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .eq('owner_id', user.id);

      if (error) throw error;
      setCategories(data?.map(cat => cat.name) || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const addSuggestedProduct = async (selectedProductId: string) => {
    if (!user) return;

    // Check if already added
    const exists = suggestedProducts.some(sp => sp.suggested_product_id === selectedProductId);
    if (exists) {
      toast({
        title: "تحذير",
        description: "هذا المنتج مضاف بالفعل كمنتج مقترح",
        variant: "destructive",
      });
      return;
    }

    try {
      const nextOrder = Math.max(...suggestedProducts.map(sp => sp.display_order), 0) + 1;
      
      const { data, error } = await (supabase as any)
        .from('suggested_products')
        .insert({
          product_id: productId,
          suggested_product_id: selectedProductId,
          owner_id: user.id,
        })
        .select('id, suggested_product_id')
        .single();

      if (error) throw error;

      // Get the product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, price, image_url, category')
        .eq('id', selectedProductId)
        .eq('owner_id', user.id)
        .single();

      if (productError) throw productError;

      const newSuggestedProduct = {
        ...(data as any),
        product: productData
      };

      setSuggestedProducts([...suggestedProducts, newSuggestedProduct]);
      setDialogOpen(false);
      toast({
        title: "تمت الإضافة",
        description: "تم إضافة المنتج إلى قائمة المنتجات المقترحة",
      });
    } catch (error) {
      console.error('Error adding suggested product:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في إضافة المنتج المقترح",
        variant: "destructive",
      });
    }
  };

  const removeSuggestedProduct = async (suggestionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('suggested_products')
        .delete()
        .eq('id', suggestionId)
        .eq('owner_id', user.id);

      if (error) throw error;

      setSuggestedProducts(suggestedProducts.filter(sp => sp.id !== suggestionId));
      toast({
        title: "تم الحذف",
        description: "تم حذف المنتج من قائمة المنتجات المقترحة",
      });
    } catch (error) {
      console.error('Error removing suggested product:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في حذف المنتج المقترح",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = availableProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const notAlreadyAdded = !suggestedProducts.some(sp => sp.suggested_product_id === product.id);
    
    return matchesSearch && matchesCategory && notAlreadyAdded;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">جاري التحميل...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                إضافة منتج مقترح
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-right">اختيار منتج مقترح</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Search and Filter */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="search" className="text-right block mb-2">البحث</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="search"
                        placeholder="ابحث عن منتج..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 text-right"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="category" className="text-right block mb-2">الفئة</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفئات</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Products Grid */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      لا توجد منتجات متاحة للإضافة
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredProducts.map((product) => (
                        <div
                          key={product.id}
                          className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => addSuggestedProduct(product.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-1 text-right">
                              <h3 className="font-semibold">{product.name}</h3>
                              <p className="text-sm text-gray-600">{product.category}</p>
                              <p className="text-lg font-bold text-blue-600">
                                {product.price.toLocaleString()} د.ع
                              </p>
                            </div>
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="text-right">
            <CardTitle>المنتجات المقترحة</CardTitle>
            <div className="text-sm text-gray-600 mt-1">{productName}</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {suggestedProducts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            لم تتم إضافة منتجات مقترحة لهذا المنتج حتى الآن
            <br />
            <span className="text-sm">ستظهر المنتجات المقترحة في صفحة تفاصيل المنتج للعملاء</span>
          </div>
        ) : (
          <div className="grid gap-4">
            {suggestedProducts.map((suggestedProduct) => (
              <div key={suggestedProduct.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      ترتيب {suggestedProduct.display_order}
                    </Badge>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-right">تأكيد الحذف</AlertDialogTitle>
                          <AlertDialogDescription className="text-right">
                            هل أنت متأكد من حذف هذا المنتج من قائمة المنتجات المقترحة؟
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => removeSuggestedProduct(suggestedProduct.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <h3 className="font-semibold">{suggestedProduct.product.name}</h3>
                      <p className="text-sm text-gray-600">{suggestedProduct.product.category}</p>
                      <p className="text-lg font-bold text-blue-600">
                        {suggestedProduct.product.price.toLocaleString()} د.ع
                      </p>
                    </div>
                    {suggestedProduct.product.image_url ? (
                      <img
                        src={suggestedProduct.product.image_url}
                        alt={suggestedProduct.product.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {suggestedProducts.length > 0 && (
          <div className="text-sm text-gray-500 text-center mt-4 p-4 bg-blue-50 rounded-lg">
            💡 نصيحة: المنتجات المقترحة ستظهر في صفحة تفاصيل المنتج وتساعد في زيادة المبيعات
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SuggestedProductsManager;