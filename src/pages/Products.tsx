
import { useState, useEffect } from "react";
import { ArrowLeft, MessageSquare, Lightbulb, Download } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductsList } from "@/components/ProductsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductReviewsManager from "@/components/product-management/ProductReviewsManager";
import SuggestedProductsManager from "@/components/product-management/SuggestedProductsManager";
import { Product } from "@/types";
import { exportProductsToCSV } from "@/utils/exportProducts";
import { toast } from "sonner";

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState<{id: string, name: string} | null>(null);
  const [loadedProducts, setLoadedProducts] = useState<Product[]>([]);
  
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

  const handleExport = () => {
    if (loadedProducts.length === 0) {
      toast.error("لا توجد منتجات للتصدير");
      return;
    }
    exportProductsToCSV(loadedProducts);
    toast.success(`تم تصدير ${loadedProducts.length} منتج بنجاح`);
  };

  return (
    <div className="min-h-screen bg-background font-arabic">
      {/* Header */}
      <div className="bg-card shadow-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-muted rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">إدارة المنتجات</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-card rounded-3xl shadow-sm border border-border p-4 sm:p-8">
          {selectedProduct ? (
            <div className="space-y-6">
              <div className="flex justify-start items-center">
                <Button 
                  variant="outline" 
                  onClick={handleBackToList}
                  className="flex items-center gap-2 hover:bg-muted rounded-xl border-border text-foreground"
                >
                  ← العودة
                </Button>
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
            <>
              <div className="flex justify-between items-center mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border text-foreground text-xs"
                  onClick={handleExport}
                >
                  <Download className="w-3.5 h-3.5 ml-1" />
                  تصدير CSV
                </Button>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">قائمة المنتجات</h2>
              </div>

              <ProductsList 
                onProductSelect={handleProductSelect} 
                onProductsLoaded={setLoadedProducts}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;
