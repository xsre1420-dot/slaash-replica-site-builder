
import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from "react";
import { isProductLowStock } from '@/lib/productUpdateUtils';
import { Link, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Lightbulb, Plus, Search, ArrowRight, Package, XCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ProductsList } from "@/components/ProductsList";
import StatCard from "@/components/ui/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product } from "@/types";
import { toast } from 'sonner';
import { getCategories, invalidateProducts, loadAllMerchantProducts as reloadProductsData } from "@/services/productService";
import { getFirstPendingReviewTarget, countPendingReviewsForOwner } from "@/services/reviewService";
import { getProductLifecycleStatus, matchesLifecycleFilter, type ProductLifecycleFilter } from "@/lib/productLifecycle";
import type { ProductSaveMode } from "@/lib/productFormLabels";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeProducts } from "@/hooks/useRealtimeProducts";
import { useScrollPersistence, saveFilters, loadFilters } from "@/hooks/useScrollPersistence";
import { useStoreHydration } from "@/context/StoreBootstrapContext";
import AttentionStrip from "@/components/ui/AttentionStrip";
import { ATTENTION_PARAM } from "@/lib/attentionHighlight";

// Suggestion #8: Lazy load sub-managers
const ProductReviewsManager = lazy(() => import("@/components/product-management/ProductReviewsManager"));
const SuggestedProductsManager = lazy(() => import("@/components/product-management/SuggestedProductsManager"));

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isReady, hydrationVersion } = useStoreHydration();
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<{id: string, name: string} | null>(null);
  const [loadedProducts, setLoadedProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [publishFilter, setPublishFilter] = useState<ProductLifecycleFilter>("all");
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [categories, setCategories] = useState<{id: string; name: string}[]>([]);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const attentionApplied = useRef(false);
  
  // Suggestion #17: Scroll & filter persistence
  useScrollPersistence('products');

  // Realtime subscriptions
  const handleRealtimeUpdate = useCallback(async () => {
    await invalidateProducts();
    const result = await reloadProductsData(true);
    setLoadedProducts(result.products);
    setCatalogTotal(result.total);
  }, []);
  useRealtimeProducts(handleRealtimeUpdate);

  const reloadCatalog = useCallback(async () => {
    if (!user?.id) {
      setLoadedProducts([]);
      setCatalogLoading(false);
      return [];
    }

    setCatalogLoading(true);
    try {
      await invalidateProducts();
      const result = await reloadProductsData(true);
      setLoadedProducts(result.products);
      setCatalogTotal(result.total);
      return result.products;
    } catch (err) {
      console.error('[Products] failed to load catalog:', err);
      toast.error('تعذر تحميل المنتجات — حاول تحديث الصفحة');
      setLoadedProducts([]);
      return [];
    } finally {
      setCatalogLoading(false);
    }
  }, [user?.id]);

  // Initial load + re-hydration after login
  useEffect(() => {
    if (!isReady || !user?.id) return;
    void reloadCatalog();
  }, [isReady, hydrationVersion, reloadCatalog, user?.id]);

  const productIdParam = searchParams.get('productId');
  const productNameParam = searchParams.get('productName');
  
  useEffect(() => {
    if (productIdParam && productNameParam) {
      setSelectedProduct({id: productIdParam, name: decodeURIComponent(productNameParam)});
    }
  }, [productIdParam, productNameParam]);

  useEffect(() => {
    const attention = searchParams.get(ATTENTION_PARAM);
    if (!attention || attentionApplied.current || !user?.id) return;

    if (attention === 'draft-products') {
      attentionApplied.current = true;
      setPublishFilter('draft');
      return;
    }

    if (attention === 'pending-reviews') {
      attentionApplied.current = true;
      void getFirstPendingReviewTarget(user.id).then((target) => {
        if (!target) return;
        setSelectedProduct({ id: target.productId, name: target.productName });
        setSearchParams({
          productId: target.productId,
          productName: encodeURIComponent(target.productName),
          [ATTENTION_PARAM]: 'pending-reviews',
        });
      });
    }
  }, [searchParams, user?.id, setSearchParams]);

  // Load categories
  useEffect(() => {
    getCategories().then(cats => setCategories(cats));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setPendingReviewsCount(0);
      return;
    }
    void countPendingReviewsForOwner(user.id).then(setPendingReviewsCount);
  }, [user?.id, loadedProducts.length]);

  // Restore saved filters once (skip when arriving from add-product)
  useEffect(() => {
    const state = location.state as { refreshProducts?: boolean } | null;
    if (state?.refreshProducts) return;
    const saved = loadFilters('products');
    if (!saved) return;
    if (saved.categoryFilter) setCategoryFilter(saved.categoryFilter);
    if (saved.stockFilter) setStockFilter(saved.stockFilter);
    if (saved.publishFilter === 'published' || saved.publishFilter === 'draft' || saved.publishFilter === 'archived' || saved.publishFilter === 'all') {
      setPublishFilter(saved.publishFilter);
    }
    if (saved.searchQuery) setSearchQuery(saved.searchQuery);
  }, []);

  // Drop stale category filter values (e.g. old UUIDs) that hide all products
  useEffect(() => {
    if (categoryFilter === 'all' || categories.length === 0) return;
    if (!categories.some((c) => c.name === categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categories, categoryFilter]);

  // Save filters when they change
  useEffect(() => {
    saveFilters('products', { categoryFilter, stockFilter, searchQuery, publishFilter });
  }, [categoryFilter, stockFilter, searchQuery, publishFilter]);

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

  // Stats (memoized)
  const stats = useMemo(() => ({
    total: catalogTotal || loadedProducts.length,
    published: loadedProducts.filter((p) => getProductLifecycleStatus(p) === 'published').length,
    drafts: loadedProducts.filter((p) => getProductLifecycleStatus(p) === 'draft').length,
    archived: loadedProducts.filter((p) => getProductLifecycleStatus(p) === 'archived').length,
    inStock: loadedProducts.filter((p) => !isProductLowStock(p) && (p.stockQuantity ?? 0) > 0).length,
    lowStock: loadedProducts.filter((p) => isProductLowStock(p)).length,
    outOfStock: loadedProducts.filter(p => p.stockQuantity !== undefined && p.stockQuantity === 0).length,
    totalValue: loadedProducts.reduce((sum, p) => sum + p.price * (p.stockQuantity ?? 1), 0),
  }), [loadedProducts, catalogTotal]);

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStockFilter("all");
    setPublishFilter("all");
    saveFilters('products', { categoryFilter: 'all', stockFilter: 'all', searchQuery: '', publishFilter: 'all' });
  };

  // After add-product: clear saved filters and reload from DB
  useEffect(() => {
    const state = location.state as {
      refreshProducts?: boolean;
      createdProductId?: string;
      saveMode?: ProductSaveMode;
    } | null;
    if (!state?.refreshProducts) return;

    clearFilters();
    void reloadCatalog().then((data) => {
      if (state.createdProductId && !data.some((p) => p.id === state.createdProductId)) {
        toast.error('تم الحفظ لكن تعذر عرض المنتج — حدّث الصفحة');
      }
    });
    navigate('/products', { replace: true, state: {} });
  }, [location.state, navigate, reloadCatalog]);

  const filtersActive =
    categoryFilter !== 'all' || stockFilter !== 'all' || publishFilter !== 'all' || !!debouncedSearch.trim();

  const filteredProducts = useMemo(() => loadedProducts.filter(p => {
    const matchesSearch = !debouncedSearch || 
      p.name.includes(debouncedSearch) || 
      p.description?.includes(debouncedSearch) ||
      p.category?.includes(debouncedSearch);
    
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;

    const matchesPublish = matchesLifecycleFilter(p, publishFilter);
    
    let matchesStock = true;
    if (stockFilter === "in_stock") matchesStock = !isProductLowStock(p) && (p.stockQuantity ?? 0) > 0;
    else if (stockFilter === "low") matchesStock = isProductLowStock(p);
    else if (stockFilter === "out") matchesStock = p.stockQuantity !== undefined && p.stockQuantity === 0;

    return matchesSearch && matchesCategory && matchesPublish && matchesStock;
  }), [loadedProducts, debouncedSearch, categoryFilter, stockFilter, publishFilter]);

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

            <AttentionStrip
              attentionKey="pending-reviews"
              visible={pendingReviewsCount > 0}
              icon={MessageSquare}
              message={`${pendingReviewsCount} ${
                pendingReviewsCount === 1 ? 'تقييم' : 'تقييمات'
              } بانتظار المعالجة — اختر منتجاً لمراجعة التعليقات`}
            />

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
          <div className="space-y-6 min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4">
              <StatCard
                label="إجمالي المنتجات"
                value={stats.total}
                icon={Package}
                className="p-3.5 sm:p-5 [&_.ds-stat-value]:text-xl sm:[&_.ds-stat-value]:text-2xl lg:[&_.ds-stat-value]:text-3xl"
              />
              <StatCard
                label="منشور"
                value={stats.published}
                icon={Package}
                iconClassName="bg-emerald-500/10 [&_svg]:text-emerald-600"
                className="p-3.5 sm:p-5 [&_.ds-stat-value]:text-xl sm:[&_.ds-stat-value]:text-2xl lg:[&_.ds-stat-value]:text-3xl"
              />
              <StatCard
                label="مسودات"
                value={stats.drafts}
                icon={Package}
                iconClassName="bg-muted [&_svg]:text-muted-foreground"
                className="p-3.5 sm:p-5 [&_.ds-stat-value]:text-xl sm:[&_.ds-stat-value]:text-2xl lg:[&_.ds-stat-value]:text-3xl"
              />
              <StatCard
                label="مؤرشف"
                value={stats.archived}
                icon={Package}
                iconClassName="bg-muted [&_svg]:text-muted-foreground"
                className="p-3.5 sm:p-5 [&_.ds-stat-value]:text-xl sm:[&_.ds-stat-value]:text-2xl lg:[&_.ds-stat-value]:text-3xl"
              />
              <StatCard
                label="نفد المخزون"
                value={stats.outOfStock}
                icon={XCircle}
                iconClassName="bg-destructive/10 [&_svg]:text-destructive"
                className="col-span-2 md:col-span-1 p-3.5 sm:p-5 [&_.ds-stat-value]:text-xl sm:[&_.ds-stat-value]:text-2xl lg:[&_.ds-stat-value]:text-3xl"
              />
            </div>

            {stats.drafts > 0 && (
              <AttentionStrip
                attentionKey="draft-products"
                message={`${stats.drafts} ${
                  stats.drafts === 1 ? 'مسودة' : 'مسودات'
                } غير منشورة — انشرها لتظهر في المتجر`}
              />
            )}

            {pendingReviewsCount > 0 && (
              <AttentionStrip
                attentionKey="pending-reviews"
                icon={MessageSquare}
                message={`${pendingReviewsCount} ${
                  pendingReviewsCount === 1 ? 'تقييم' : 'تقييمات'
                } بانتظار المعالجة — اختر منتجاً من القائمة لمراجعة التعليقات`}
              />
            )}

            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="space-y-3 min-w-0">
                  <div className="relative w-full min-w-0">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="بحث عن منتج..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 rounded-xl border-border text-foreground w-full min-h-[44px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-3 min-w-0">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="rounded-xl border-border text-foreground w-full min-h-[44px]">
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
                    <SelectTrigger className="rounded-xl border-border text-foreground w-full min-h-[44px]">
                      <SelectValue placeholder="المخزون" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-popover border-border">
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="in_stock">متوفر</SelectItem>
                      <SelectItem value="low">منخفض المخزون</SelectItem>
                      <SelectItem value="out">نفد المخزون</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={publishFilter} onValueChange={(v) => setPublishFilter(v as ProductLifecycleFilter)}>
                    <SelectTrigger className="rounded-xl border-border text-foreground w-full min-h-[44px]">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-popover border-border">
                      <SelectItem value="all">كل الحالات</SelectItem>
                      <SelectItem value="published">منشور</SelectItem>
                      <SelectItem value="draft">مسودة</SelectItem>
                      <SelectItem value="archived">مؤرشف</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products List */}
            {!catalogLoading && loadedProducts.length > 0 && filteredProducts.length === 0 && filtersActive && (
              <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  الفلاتر الحالية تخفي كل المنتجات ({loadedProducts.length} منتج في متجرك)
                </p>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={clearFilters}>
                  مسح الفلاتر
                </Button>
              </div>
            )}

            <div className="ds-card p-4 sm:p-6">
              <ProductsList 
                onProductSelect={handleProductSelect} 
                products={loadedProducts}
                filteredProducts={filteredProducts}
                filtersActive={filtersActive}
                onProductsChange={setLoadedProducts}
                onClearFilters={clearFilters}
                isLoading={!isReady || catalogLoading}
                reloadToken={hydrationVersion}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Products;
