import { useState, useEffect } from "react";
import { X, MessageSquare, Lightbulb, Trash2 } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductsList } from "@/components/ProductsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductReviewsManager from "@/components/product-management/ProductReviewsManager";
import SuggestedProductsManager from "@/components/product-management/SuggestedProductsManager";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { deleteProduct } from "@/data/dummyData";
import { toast } from "sonner";

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<{id: string, name: string} | null>(null);
  
  // Get product ID from URL params for deep linking
  const productIdParam = searchParams.get('productId');
  const productNameParam = searchParams.get('productName');
  
  useEffect(() => {
    if (productIdParam && productNameParam) {
      setSelectedProduct({id: productIdParam, name: decodeURIComponent(productNameParam)});
    }
  }, [productIdParam, productNameParam]);

  const handleProductSelect = (product: {id: string, name: string}) => {
    setSelectedProduct(product);
    setSearchParams({productId: product.id, productName: encodeURIComponent(product.name)});
  };

  const handleBackToList = () => {
    setSelectedProduct(null);
    setSearchParams({});
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    const result = await deleteProduct(selectedProduct.id);
    if (result.success) {
      toast.success("تم حذف المنتج بنجاح");
      handleBackToList();
      navigate('/products');
    } else {
      toast.error("فشل حذف المنتج");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Modern Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-black">
              {selectedProduct ? `إدارة ${selectedProduct.name}` : 'إدارة المنتجات'}
            </h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8">
          {selectedProduct ? (
            // Product Management View
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleBackToList}
                    className="flex items-center gap-2 hover:bg-gray-50"
                  >
                    ← العودة
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive"
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف المنتج
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-right">هل أنت متأكد من حذف هذا المنتج؟</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">
                          هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المنتج "{selectedProduct.name}" نهائياً من قاعدة البيانات.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteProduct}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          نعم، احذف المنتج
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <h2 className="text-xl font-bold text-gray-800 text-right">
                  إدارة: {selectedProduct.name}
                </h2>
              </div>

              <Tabs defaultValue="reviews" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="reviews" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    إدارة التعليقات
                  </TabsTrigger>
                  <TabsTrigger value="suggestions" className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    المنتجات المقترحة
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="reviews" className="mt-6">
                  <ProductReviewsManager 
                    productId={selectedProduct.id} 
                    productName={selectedProduct.name}
                  />
                </TabsContent>
                
                <TabsContent value="suggestions" className="mt-6">
                  <SuggestedProductsManager 
                    productId={selectedProduct.id} 
                    productName={selectedProduct.name}
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            // Products List View
            <>
              <div className="flex justify-end items-center mb-8">
                <h2 className="text-2xl font-bold text-black">قائمة المنتجات</h2>
              </div>

              <ProductsList onProductSelect={handleProductSelect} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;