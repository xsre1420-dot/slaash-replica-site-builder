import { useState, useEffect } from "react";
import { X, MessageSquare, Lightbulb } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductsList } from "@/components/ProductsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductReviewsManager from "@/components/product-management/ProductReviewsManager";
import SuggestedProductsManager from "@/components/product-management/SuggestedProductsManager";

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
              إدارة المنتجات
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
              <div className="flex justify-start items-center">
                <Button 
                  variant="outline" 
                  onClick={handleBackToList}
                  className="flex items-center gap-2 hover:bg-gray-50"
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