
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { ArrowLeft, MessageSquare, Lightbulb, Download, Plus, Package, AlertTriangle, XCircle, DollarSign, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ProductsList } from "@/components/ProductsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product } from "@/types";
import { exportProductsToCSV } from "@/utils/exportProducts";
import { toast } from "sonner";
import { getCategories } from "@/data/dummyData";
import { useRealtimeProducts } from "@/hooks/useRealtimeProducts";
import { useScrollPersistence, saveFilters, loadFilters } from "@/hooks/useScrollPersistence";

// Suggestion #8: Lazy load sub-managers
const ProductReviewsManager = lazy(() => import("@/components/product-management/ProductReviewsManager"));
const SuggestedProductsManager = lazy(() => import("@/components/product-management/SuggestedProductsManager"));

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState<{id: string, name: string} | null>(null);
  const [loadedProducts, setLoadedProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [categories, setCategories] = useState<{id: string; name: string}[]>([]);
  
  // Suggestion #17: Scroll & filter persistence
  useScrollPersistence('products');

  // Suggestion #11: Realtime subscriptions
  const handleRealtimeUpdate = useCallback(() => {
    // Products will be reloaded by the hook
  }, []);
  useRealtimeProducts(handleRealtimeUpdate);

  const productIdParam = searchParams.get('productId');
  const productNameParam = searchParams.get('productName');
  
  useEffect(() => {
    if (productIdParam && productNameParam) {
      setSelectedProduct({id: productIdParam, name: decodeURIComponent(productNameParam)});
    }
  }, [productIdParam, productNameParam]);

  // Load categories
  useEffect(() => {
    getCategories().then(cats => setCategories(cats));
  }, []);

  // Suggestion #17: Restore saved filters
  useEffect(() => {
    const saved = loadFilters('products');
    if (saved) {
      if (saved.categoryFilter) setCategoryFilter(saved.categoryFilter);
      if (saved.stockFilter) setStockFilter(saved.stockFilter);
      if (saved.searchQuery) setSearchQuery(saved.searchQuery);
    }
  }, []);

  // Save filters when they change
  useEffect(() => {
    saveFilters('products', { categoryFilter, stockFilter, searchQuery });
  }, [categoryFilter, stockFilter, searchQuery]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // Stats
  const totalProducts = loadedProducts.length;
  const inStock = loadedProducts.filter(p => (p.stockQuantity ?? 1) > 5).length;
  const lowStock = loadedProducts.filter(p => p.stockQuantity !== undefined && p.stockQuantity > 0 && p.stockQuantity <= 5).length;
  const outOfStock = loadedProducts.filter(p => p.stockQuantity !== undefined && p.stockQuantity === 0).length;
  const totalValue = loadedProducts.reduce((sum, p) => sum + p.price * (p.stockQuantity ?? 1), 0);

  // Filtered products
  const filteredProducts = loadedProducts.filter(p => {
    const matchesSearch = !debouncedSearch || 
      p.name.includes(debouncedSearch) || 
      p.description?.includes(debouncedSearch) ||
      p.category?.includes(debouncedSearch);
    
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    
    let matchesStock = true;
    if (stockFilter === "in_stock") matchesStock = (p.stockQuantity ?? 1) > 5;
    else if (stockFilter === "low") matchesStock = p.stockQuantity !== undefined && p.stockQuantity > 0 && p.stockQuantity <= 5;
    else if (stockFilter === "out") matchesStock = p.stockQuantity !== undefined && p.stockQuantity === 0;

    return matchesSearch && matchesCategory && matchesStock;
  });

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

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        {selectedProduct ? (
          <div className="bg-card rounded-3xl shadow-sm border border-border p-4 sm:p-8 space-y-6">
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
                <Suspense fallback={<div className="py-8 text-center text-muted-foreground">جاري التحميل...</div>}>
                  <ProductReviewsManager 
                    productId={selectedProduct.id} 
                    productName={selectedProduct.name}
                  />
                </Suspense>
              </TabsContent>
              
              <TabsContent value="suggestions" className="mt-6">
                <Suspense fallback={<div className="py-8 text-center text-muted-foreground">جاري التحميل...</div>}>
                  <SuggestedProductsManager 
                    productId={selectedProduct.id} 
                    productName={selectedProduct.name}
                  />
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border border-border rounded-2xl shadow-sm">
                <CardContent className="p-4 text-center">
                  <Package className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                  <p className="text-2xl font-bold text-foreground">{totalProducts}</p>
                  <p className="text-xs text-muted-foreground">إجمالي المنتجات</p>
                </CardContent>
              </Card>
              <Card className="border border-border rounded-2xl shadow-sm">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-1.5 text-yellow-500" />
                  <p className="text-2xl font-bold text-foreground">{lowStock}</p>
                  <p className="text-xs text-muted-foreground">منخفض المخزون</p>
                </CardContent>
              </Card>
              <Card className="border border-border rounded-2xl shadow-sm">
                <CardContent className="p-4 text-center">
                  <XCircle className="w-5 h-5 mx-auto mb-1.5 text-red-500" />
                  <p className="text-2xl font-bold text-foreground">{outOfStock}</p>
                  <p className="text-xs text-muted-foreground">نفد المخزون</p>
                </CardContent>
              </Card>
              <Card className="border border-border rounded-2xl shadow-sm">
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-5 h-5 mx-auto mb-1.5 text-foreground" />
                  <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{totalValue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">القيمة (د.ع)</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters & Actions */}
            <Card className="border border-border rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="relative lg:col-span-2">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="بحث عن منتج..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 rounded-xl border-border text-foreground"
                    />
                  </div>
                  
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="rounded-xl border-border text-foreground">
                      <SelectValue placeholder="الفئة" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-popover border-border">
                      <SelectItem value="all">جميع الفئات</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger className="rounded-xl border-border text-foreground">
                      <SelectValue placeholder="المخزون" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-popover border-border">
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="in_stock">متوفر</SelectItem>
                      <SelectItem value="low">منخفض المخزون</SelectItem>
                      <SelectItem value="out">نفد المخزون</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-border text-foreground text-xs flex-1"
                      onClick={handleExport}
                    >
                      <Download className="w-3.5 h-3.5 ml-1" />
                      تصدير
                    </Button>
                    <Link to="/add-product" className="flex-1">
                      <Button size="sm" className="rounded-xl text-xs w-full">
                        <Plus className="w-3.5 h-3.5 ml-1" />
                        إضافة
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products List */}
            <div className="bg-card rounded-3xl shadow-sm border border-border p-4 sm:p-6">
              <ProductsList 
                onProductSelect={handleProductSelect} 
                onProductsLoaded={setLoadedProducts}
                filteredProducts={filteredProducts}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Products;
