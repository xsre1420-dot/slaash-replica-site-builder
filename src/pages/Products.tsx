
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageSquare, Lightbulb, Download, Plus, Package, AlertTriangle, XCircle, DollarSign, Search, ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import StatCard from "@/components/ui/StatCard";
import { ProductsList } from "@/components/ProductsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product } from "@/types";
import { exportProductsToCSV } from "@/utils/exportProducts";
import { toast } from "sonner";
import { getCategories, invalidateProducts, loadProducts as reloadProductsData } from "@/services/productService";
import { useRealtimeProducts } from "@/hooks/useRealtimeProducts";
import { useScrollPersistence, saveFilters, loadFilters } from "@/hooks/useScrollPersistence";
import { BulkUpload } from "@/components/product-management/BulkUpload";

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

  // Realtime subscriptions
  const handleRealtimeUpdate = useCallback(async () => {
    invalidateProducts();
    const data = await reloadProductsData(true);
    setLoadedProducts(data);
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

  // Stats (memoized)
  const stats = useMemo(() => ({
    total: loadedProducts.length,
    inStock: loadedProducts.filter(p => (p.stockQuantity ?? 1) > 5).length,
    lowStock: loadedProducts.filter(p => p.stockQuantity !== undefined && p.stockQuantity > 0 && p.stockQuantity <= 5).length,
    outOfStock: loadedProducts.filter(p => p.stockQuantity !== undefined && p.stockQuantity === 0).length,
    totalValue: loadedProducts.reduce((sum, p) => sum + p.price * (p.stockQuantity ?? 1), 0),
  }), [loadedProducts]);

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStockFilter("all");
  };

  const filteredProducts = useMemo(() => loadedProducts.filter(p => {
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
  }), [loadedProducts, debouncedSearch, categoryFilter, stockFilter]);

  return (
    <DashboardLayout>
      <PageHeader
        title="إدارة المنتجات"
        description="أضف وعدّل وتابع منتجات متجرك"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'المنتجات' }]}
        actions={
          <Link to="/add-product">
            <Button size="sm" className="rounded-xl min-h-[44px]">
              <Plus className="w-4 h-4" />
              إضافة
            </Button>
          </Link>
        }
      />

      <div className="ds-page max-w-6xl">
        {selectedProduct ? (
          <div className="ds-card p-4 sm:p-8 space-y-6">
            <div className="flex justify-start items-center">
              <Button
                variant="outline"
                onClick={handleBackToList}
                className="flex items-center gap-2 rounded-xl border-border/60 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
              >
                <ArrowRight className="w-4 h-4" />
                العودة
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="إجمالي المنتجات" value={stats.total} icon={Package} />
              <StatCard label="منخفض المخزون" value={stats.lowStock} icon={AlertTriangle} iconClassName="bg-warning/10 [&_svg]:text-warning" />
              <StatCard label="نفد المخزون" value={stats.outOfStock} icon={XCircle} iconClassName="bg-destructive/10 [&_svg]:text-destructive" />
              <StatCard label="القيمة (د.ع)" value={stats.totalValue.toLocaleString()} icon={DollarSign} />
            </div>

            {/* Filters & Actions */}
            <Card>
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
                    <BulkUpload onComplete={async () => {
                      invalidateProducts();
                      const data = await reloadProductsData(true);
                      setLoadedProducts(data);
                    }} />
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-border text-foreground text-xs min-h-[44px]"
                      onClick={handleExport}
                    >
                      <Download className="w-3.5 h-3.5 ml-1" />
                      تصدير
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products List */}
            <div className="ds-card p-4 sm:p-6">
              <ProductsList 
                onProductSelect={handleProductSelect} 
                onProductsLoaded={setLoadedProducts}
                filteredProducts={filteredProducts}
                onClearFilters={clearFilters}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Products;
