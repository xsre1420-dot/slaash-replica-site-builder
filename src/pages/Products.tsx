import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Lightbulb,
  Plus,
  ArrowRight,
  Package,
  XCircle,
  FileEdit,
  Archive,
  AlertTriangle,
  Download,
  Wallet,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { ProductsList } from '@/components/ProductsList';
import StatCard from '@/components/ui/StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductsWorkflowTabs from '@/components/products/ProductsWorkflowTabs';
import ProductsToolbar, { type ProductViewMode } from '@/components/products/ProductsToolbar';
import ProductsBulkBar from '@/components/products/ProductsBulkBar';
import ProductsDataTable from '@/components/products/ProductsDataTable';
import { BulkUpload } from '@/components/product-management/BulkUpload';
import { QuickEditDialog } from '@/components/product-management/QuickEditDialog';
import { Product } from '@/types';
import { toast } from 'sonner';
import {
  getCategories,
  invalidateProducts,
  loadAllMerchantProducts as reloadProductsData,
  publishProduct,
  setProductLifecycle,
  addProduct,
} from '@/services/productService';
import { getFirstPendingReviewTarget, countPendingReviewsForOwner } from '@/services/reviewService';
import { getProductLifecycleStatus } from '@/lib/productLifecycle';
import type { ProductSaveMode } from '@/lib/productFormLabels';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeProducts } from '@/hooks/useRealtimeProducts';
import { useScrollPersistence, saveFilters, loadFilters } from '@/hooks/useScrollPersistence';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import AttentionStrip from '@/components/ui/AttentionStrip';
import { ATTENTION_PARAM } from '@/lib/attentionHighlight';
import EmptyState from '@/components/ui/EmptyState';
import {
  applyProductCatalogFilters,
  computeProductCatalogStats,
  countProductsByLifecycle,
  DEFAULT_PRODUCT_CATALOG_FILTERS,
  filterProductCatalog,
  formatProductInventoryValue,
  type ProductCatalogFilters,
} from '@/utils/productCatalogPageUtils';
import {
  buildProductsExportFilename,
  exportProductsToCsv,
} from '@/utils/productExportUtils';
import { generateUUID } from '@/lib/uuid';

const ProductReviewsManager = lazy(() => import('@/components/product-management/ProductReviewsManager'));
const SuggestedProductsManager = lazy(() => import('@/components/product-management/SuggestedProductsManager'));
const FooterSuggestedProductsManager = lazy(
  () => import('@/components/product-management/FooterSuggestedProductsManager')
);

const VIEW_MODE_KEY = 'products_view_mode';

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isReady, hydrationVersion } = useStoreHydration();
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [loadedProducts, setLoadedProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogFilters, setCatalogFilters] = useState<ProductCatalogFilters>(DEFAULT_PRODUCT_CATALOG_FILTERS);
  const debouncedSearch = useDebouncedValue(catalogFilters.search, 350);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ProductViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_MODE_KEY) as ProductViewMode) || 'grid';
    } catch {
      return 'grid';
    }
  });
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const attentionApplied = useRef(false);

  useScrollPersistence('products');

  const listFilters = useMemo(
    () => ({ ...catalogFilters, search: debouncedSearch }),
    [catalogFilters, debouncedSearch]
  );

  const handleRealtimeUpdate = useCallback(async () => {
    await invalidateProducts();
    const result = await reloadProductsData(true);
    setLoadedProducts(result.products);
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

  useEffect(() => {
    if (!isReady || !user?.id) return;
    void reloadCatalog();
  }, [isReady, hydrationVersion, reloadCatalog, user?.id]);

  const productIdParam = searchParams.get('productId');
  const productNameParam = searchParams.get('productName');

  useEffect(() => {
    if (productIdParam && productNameParam) {
      setSelectedProduct({ id: productIdParam, name: decodeURIComponent(productNameParam) });
    }
  }, [productIdParam, productNameParam]);

  useEffect(() => {
    const attention = searchParams.get(ATTENTION_PARAM);
    if (!attention || attentionApplied.current || !user?.id) return;

    if (attention === 'draft-products') {
      attentionApplied.current = true;
      setCatalogFilters((prev) => ({ ...prev, lifecycle: 'draft' }));
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

  useEffect(() => {
    getCategories().then((cats) => setCategories(cats));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setPendingReviewsCount(0);
      return;
    }
    void countPendingReviewsForOwner(user.id).then(setPendingReviewsCount);
  }, [user?.id, loadedProducts.length]);

  useEffect(() => {
    const state = location.state as { refreshProducts?: boolean } | null;
    if (state?.refreshProducts) return;
    const saved = loadFilters('products') as Record<string, string> | null;
    if (!saved) return;
    setCatalogFilters((prev) => ({
      ...prev,
      category: saved.categoryFilter || saved.category || prev.category,
      stock: (saved.stockFilter as ProductCatalogFilters['stock']) || prev.stock,
      lifecycle:
        saved.publishFilter === 'published' ||
        saved.publishFilter === 'draft' ||
        saved.publishFilter === 'archived' ||
        saved.publishFilter === 'all'
          ? saved.publishFilter
          : prev.lifecycle,
      search: saved.searchQuery || saved.search || prev.search,
      sort: (saved.sort as ProductCatalogFilters['sort']) || prev.sort,
    }));
  }, []);

  useEffect(() => {
    if (catalogFilters.category === 'all' || categories.length === 0) return;
    if (!categories.some((c) => c.name === catalogFilters.category)) {
      setCatalogFilters((prev) => ({ ...prev, category: 'all' }));
    }
  }, [categories, catalogFilters.category]);

  useEffect(() => {
    saveFilters('products', {
      categoryFilter: catalogFilters.category,
      stockFilter: catalogFilters.stock,
      searchQuery: catalogFilters.search,
      publishFilter: catalogFilters.lifecycle,
      sort: catalogFilters.sort,
    });
  }, [catalogFilters]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const handleProductSelect = (product: { id: string; name: string }) => {
    setSelectedProduct(product);
    setSearchParams({ productId: product.id, productName: encodeURIComponent(product.name) });
  };

  const handleBackToList = () => {
    setSelectedProduct(null);
    setSearchParams({});
  };

  const stats = useMemo(
    () => computeProductCatalogStats(loadedProducts),
    [loadedProducts]
  );

  const tabCountBase = useMemo(
    () => filterProductCatalog(loadedProducts, { ...listFilters, lifecycle: 'all' }),
    [loadedProducts, listFilters]
  );
  const tabCounts = useMemo(() => countProductsByLifecycle(tabCountBase), [tabCountBase]);

  const visibleProducts = useMemo(
    () => applyProductCatalogFilters(loadedProducts, listFilters),
    [loadedProducts, listFilters]
  );

  const categoryNames = useMemo(() => {
    const fromDb = categories.map((c) => c.name);
    const fromProducts = loadedProducts.map((p) => p.category).filter(Boolean);
    return [...new Set([...fromDb, ...fromProducts])].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [categories, loadedProducts]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleProducts.some((p) => p.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleProducts]);

  const updateFilters = (patch: Partial<ProductCatalogFilters>) => {
    setCatalogFilters((prev) => ({ ...prev, ...patch }));
    if ('lifecycle' in patch || 'category' in patch || 'stock' in patch || 'search' in patch) {
      setSelectedIds(new Set());
    }
  };

  const clearFilters = () => {
    setCatalogFilters(DEFAULT_PRODUCT_CATALOG_FILTERS);
    setSelectedIds(new Set());
    saveFilters('products', {
      categoryFilter: 'all',
      stockFilter: 'all',
      searchQuery: '',
      publishFilter: 'all',
      sort: 'recent',
    });
  };

  const filtersActive =
    catalogFilters.category !== 'all' ||
    catalogFilters.stock !== 'all' ||
    catalogFilters.lifecycle !== 'all' ||
    !!debouncedSearch.trim();

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleProducts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleProducts.map((p) => p.id)));
  };

  const runProductAction = async (
    product: Product,
    action: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string
  ) => {
    const result = await action();
    if (result.success) {
      toast.success(successMsg);
      await reloadCatalog();
    } else {
      toast.error(result.error || 'فشلت العملية');
    }
  };

  const handlePublish = (product: Product) =>
    runProductAction(product, () => publishProduct(product.id), `تم نشر "${product.name}"`);

  const handleArchive = (product: Product) =>
    runProductAction(product, () => setProductLifecycle(product.id, 'archive'), `تم أرشفة "${product.name}"`);

  const handleRestore = (product: Product) =>
    runProductAction(
      product,
      () => setProductLifecycle(product.id, 'restore'),
      `تم استرجاع "${product.name}" كمسودة`
    );

  const handleDuplicate = async (product: Product) => {
    const duplicated: Product = {
      ...product,
      id: generateUUID(),
      name: `${product.name} (نسخة)`,
      isActive: false,
      archivedAt: undefined,
    };
    const result = await addProduct(duplicated);
    if (result.success) {
      toast.success('تم تكرار المنتج');
      await reloadCatalog();
    } else {
      toast.error('فشل في تكرار المنتج');
    }
  };

  const runBulkLifecycle = async (mode: 'publish' | 'archive') => {
    const targets = visibleProducts.filter((p) => {
      if (!selectedIds.has(p.id)) return false;
      const lifecycle = getProductLifecycleStatus(p);
      if (mode === 'publish') return lifecycle === 'draft';
      return lifecycle === 'published';
    });

    if (targets.length === 0) {
      toast.error('لا توجد منتجات قابلة للتحديث');
      return;
    }

    setBulkProcessing(true);
    let ok = 0;
    for (const product of targets) {
      const result =
        mode === 'publish'
          ? await publishProduct(product.id)
          : await setProductLifecycle(product.id, 'archive');
      if (result.success) ok += 1;
    }
    setBulkProcessing(false);
    setSelectedIds(new Set());
    await reloadCatalog();
    toast.success(`تم تحديث ${ok} من ${targets.length} منتج`);
  };

  const handleExport = (products: Product[]) => {
    if (products.length === 0) {
      toast.error('لا توجد منتجات للتصدير');
      return;
    }
    exportProductsToCsv(products, buildProductsExportFilename());
    toast.success(`تم تصدير ${products.length} منتج`);
  };

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <BulkUpload onComplete={() => void reloadCatalog()} />
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl min-h-[40px] gap-1.5"
        onClick={() =>
          handleExport(
            selectedIds.size > 0
              ? visibleProducts.filter((p) => selectedIds.has(p.id))
              : visibleProducts
          )
        }
        disabled={visibleProducts.length === 0}
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">تصدير</span>
      </Button>
      <Link to="/add-product">
        <Button size="sm" className="rounded-xl min-h-[40px] gap-1.5">
          <Plus className="w-4 h-4" />
          إضافة
        </Button>
      </Link>
    </div>
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="إدارة المنتجات"
        description="أضف وعدّل وتابع منتجات متجرك"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'المنتجات' }]}
        actions={headerActions}
      />

      <div className="ds-page max-w-6xl min-w-0">
        {selectedProduct ? (
          <div className="ds-card p-4 sm:p-8 space-y-6">
            <div className="flex justify-end items-center" dir="rtl">
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
          <div className="space-y-5 sm:space-y-6 min-w-0 pb-24 sm:pb-6">
            {/* Primary stats — lifecycle */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 min-w-0">
              <StatCard
                label="إجمالي المنتجات"
                value={stats.total}
                icon={Package}
                onClick={() => updateFilters({ lifecycle: 'all', stock: 'all' })}
                active={catalogFilters.lifecycle === 'all' && catalogFilters.stock === 'all'}
              />
              <StatCard
                label="منشور"
                value={stats.published}
                icon={Package}
                iconClassName="bg-emerald-500/10 ring-emerald-500/15 [&_svg]:text-emerald-600"
                onClick={() => updateFilters({ lifecycle: 'published' })}
                active={catalogFilters.lifecycle === 'published'}
              />
              <StatCard
                label="مسودات"
                value={stats.drafts}
                icon={FileEdit}
                iconClassName="bg-amber-500/10 ring-amber-500/15 [&_svg]:text-amber-600"
                onClick={() => updateFilters({ lifecycle: 'draft' })}
                active={catalogFilters.lifecycle === 'draft'}
              />
              <StatCard
                label="مؤرشف"
                value={stats.archived}
                icon={Archive}
                iconClassName="bg-muted ring-border/30 [&_svg]:text-muted-foreground"
                onClick={() => updateFilters({ lifecycle: 'archived' })}
                active={catalogFilters.lifecycle === 'archived'}
              />
            </section>

            {/* Secondary stats — inventory */}
            <section className="grid grid-cols-3 gap-2 sm:gap-3 min-w-0">
              <StatCard
                label="مخزون منخفض"
                value={stats.lowStock}
                icon={AlertTriangle}
                iconClassName="bg-warning/10 ring-warning/15 [&_svg]:text-warning"
                className="p-3 sm:p-5"
                onClick={() => updateFilters({ stock: 'low', lifecycle: 'all' })}
                active={catalogFilters.stock === 'low'}
              />
              <StatCard
                label="نفد المخزون"
                value={stats.outOfStock}
                icon={XCircle}
                iconClassName="bg-destructive/10 ring-destructive/15 [&_svg]:text-destructive"
                className="p-3 sm:p-5"
                onClick={() => updateFilters({ stock: 'out', lifecycle: 'all' })}
                active={catalogFilters.stock === 'out'}
              />
              <StatCard
                label="قيمة المخزون"
                value={formatProductInventoryValue(stats.inventoryValue)}
                icon={Wallet}
                iconClassName="bg-violet-500/10 ring-violet-500/15 [&_svg]:text-violet-600"
                className="p-3 sm:p-5"
                onClick={() => navigate('/inventory')}
              />
            </section>

            <Suspense fallback={null}>
              <FooterSuggestedProductsManager />
            </Suspense>

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

            <section className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden min-w-0">
              <div className="px-3 sm:px-4 pt-3 sm:pt-3.5 pb-2 border-b border-border/40 bg-muted/20">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 px-0.5">
                  حالة العرض
                </p>
                <ProductsWorkflowTabs
                  tabCounts={tabCounts}
                  activeTab={catalogFilters.lifecycle}
                  onTabChange={(tab) => updateFilters({ lifecycle: tab })}
                  className="-mx-1"
                />
              </div>
              <ProductsToolbar
                filters={catalogFilters}
                onChange={updateFilters}
                categories={categoryNames}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                resultCount={visibleProducts.length}
                totalCount={loadedProducts.length}
                embedded
                filtersActive={filtersActive}
                onClearFilters={clearFilters}
              />
            </section>

            {!catalogLoading && loadedProducts.length > 0 && visibleProducts.length === 0 && filtersActive && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  الفلاتر الحالية تخفي كل المنتجات ({loadedProducts.length} منتج في متجرك)
                </p>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={clearFilters}>
                  مسح الفلاتر
                </Button>
              </div>
            )}

            {catalogLoading && loadedProducts.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : visibleProducts.length === 0 && !filtersActive ? (
              <EmptyState
                icon={Package}
                title="لا توجد منتجات بعد"
                description="ابدأ بإضافة أول منتج أو استورد قائمة من ملف CSV"
                actionLabel="إضافة منتج"
                onAction={() => navigate('/add-product')}
              />
            ) : (
              <div className="space-y-3 min-w-0">
                {viewMode === 'table' && (
                  <ProductsDataTable
                    products={visibleProducts}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                    allSelected={
                      selectedIds.size === visibleProducts.length && visibleProducts.length > 0
                    }
                    onQuickEdit={(p) => {
                      setQuickEditProduct(p);
                      setQuickEditOpen(true);
                    }}
                    onDuplicate={handleDuplicate}
                    onPublish={handlePublish}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    onProductSelect={handleProductSelect}
                  />
                )}

                {(viewMode === 'grid' || visibleProducts.length > 0) && (
                  <div className={viewMode === 'table' ? 'sm:hidden' : ''}>
                    <div className="ds-card p-4 sm:p-6">
                      <ProductsList
                        onProductSelect={handleProductSelect}
                        products={loadedProducts}
                        filteredProducts={visibleProducts}
                        filtersActive
                        onProductsChange={setLoadedProducts}
                        onClearFilters={clearFilters}
                        isLoading={!isReady || catalogLoading}
                        reloadToken={hydrationVersion}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        onToggleSelectAll={toggleSelectAll}
                        selectionEnabled
                        onQuickEdit={(p) => {
                          setQuickEditProduct(p);
                          setQuickEditOpen(true);
                        }}
                        onPublish={handlePublish}
                        onArchive={handleArchive}
                        onRestore={handleRestore}
                        onDuplicate={handleDuplicate}
                      />
                    </div>
                  </div>
                )}

                <ProductsBulkBar
                  selectedCount={selectedIds.size}
                  totalVisible={visibleProducts.length}
                  onSelectAll={toggleSelectAll}
                  onClearSelection={() => setSelectedIds(new Set())}
                  onBulkPublish={() => void runBulkLifecycle('publish')}
                  onBulkArchive={() => void runBulkLifecycle('archive')}
                  onBulkExport={() =>
                    handleExport(visibleProducts.filter((p) => selectedIds.has(p.id)))
                  }
                  processing={bulkProcessing}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <QuickEditDialog
        product={quickEditProduct}
        open={quickEditOpen}
        onOpenChange={setQuickEditOpen}
        onSaved={() => void reloadCatalog()}
      />
    </DashboardLayout>
  );
};

export default Products;
