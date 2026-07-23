import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  Package,
  XCircle,
  FileEdit,
  Archive,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/ui/StatCard';
import ProductsWorkflowTabs from '@/components/products/ProductsWorkflowTabs';
import ProductsToolbar from '@/components/products/ProductsToolbar';
import ProductsDataTable from '@/components/products/ProductsDataTable';
import InventoryStockDialog from '@/components/inventory/InventoryStockDialog';
import { Product } from '@/types';
import { toast } from 'sonner';
import {
  getCategories,
  publishProduct,
  setProductLifecycle,
  addProduct,
  patchMerchantStockInCache,
  updateProduct,
  fetchProductById,
} from '@/services/productService';
import { restockProduct } from '@/services/write/inventory/inventoryWriteService';
import { InventoryRestockError } from '@/services/read/inventory/inventoryReadService';
import { productToInventoryRow, type InventoryProductRow } from '@/utils/inventoryPageUtils';
import { variantStockSum } from '@/utils/inventoryUtils';
import type { ProductVariant } from '@/types';
import { useMerchantProductsPage } from '@/hooks/useMerchantProductsPage';
import { useProgressiveRender } from '@/hooks/useProgressiveRender';
import { getFirstPendingReviewTarget, countPendingReviewsForOwner } from '@/services/reviewService';
import type { ProductSaveMode } from '@/lib/productFormLabels';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeProducts } from '@/hooks/useRealtimeProducts';
import { useScrollPersistence, saveFilters, loadFilters } from '@/hooks/useScrollPersistence';
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
  getProductCatalogStockStatus,
  type ProductCatalogFilters,
} from '@/utils/productCatalogPageUtils';
import { generateUUID } from '@/lib/uuid';

const Products = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [catalogFilters, setCatalogFilters] = useState<ProductCatalogFilters>(DEFAULT_PRODUCT_CATALOG_FILTERS);
  const debouncedSearch = useDebouncedValue(catalogFilters.search, 350);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockDialogProduct, setStockDialogProduct] = useState<InventoryProductRow | null>(null);
  const [stockSaving, setStockSaving] = useState(false);
  const attentionApplied = useRef(false);

  useScrollPersistence('products');

  const listFilters = useMemo(
    () => ({ ...catalogFilters, search: debouncedSearch }),
    [catalogFilters, debouncedSearch]
  );

  const catalog = useMerchantProductsPage(debouncedSearch, catalogFilters.category, {
    profile: 'inventory',
  });

  const syncFromCacheRef = useRef(catalog.syncFromCache);
  syncFromCacheRef.current = catalog.syncFromCache;

  const handleRealtimeUpdate = useCallback(() => {
    syncFromCacheRef.current();
  }, []);
  useRealtimeProducts(handleRealtimeUpdate);

  const reloadCatalog = catalog.reload;
  const loadedProducts = catalog.products;
  const catalogLoading = catalog.loading;

  const productIdParam = searchParams.get('productId');
  const productNameParam = searchParams.get('productName');

  useEffect(() => {
    if (!productIdParam) return;
    const name = productNameParam ? decodeURIComponent(productNameParam) : 'المنتج';
    navigate(`/products/reviews/${productIdParam}`, {
      replace: true,
      state: { productName: name },
    });
  }, [productIdParam, productNameParam, navigate]);

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
        navigate(`/products/reviews/${target.productId}`, {
          state: { productName: target.productName },
        });
      });
      return;
    }

    if (attention === 'low-stock') {
      if (catalogLoading) return;
      attentionApplied.current = true;
      const outCount = loadedProducts.filter((p) => getProductCatalogStockStatus(p) === 'out').length;
      const lowCount = loadedProducts.filter((p) => getProductCatalogStockStatus(p) === 'low').length;
      setCatalogFilters((prev) => ({
        ...prev,
        lifecycle: 'all',
        stock: outCount > 0 && lowCount === 0 ? 'out' : 'low',
        sort: 'stock_asc',
      }));
    }
  }, [searchParams, user?.id, navigate, catalogLoading, loadedProducts]);

  useEffect(() => {
    getCategories().then((cats) => setCategories(cats));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setPendingReviewsCount(0);
      return;
    }
    void countPendingReviewsForOwner(user.id).then(setPendingReviewsCount);
  }, [user?.id]);

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

  const { visibleItems: pagedVisibleProducts, hasMore: hasMoreToRender, loadMore: renderMore } =
    useProgressiveRender(visibleProducts, 48);

  const categoryNames = useMemo(() => {
    const fromDb = categories.map((c) => c.name);
    const fromProducts = loadedProducts.map((p) => p.category).filter(Boolean);
    return [...new Set([...fromDb, ...fromProducts])].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [categories, loadedProducts]);

  const updateFilters = (patch: Partial<ProductCatalogFilters>) => {
    setCatalogFilters((prev) => ({ ...prev, ...patch }));
  };

  const clearFilters = () => {
    setCatalogFilters(DEFAULT_PRODUCT_CATALOG_FILTERS);
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
    void reloadCatalog();
    navigate('/products', { replace: true, state: {} });
  }, [location.state, navigate, reloadCatalog, clearFilters]);

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

  const inventoryRowsById = useMemo(() => {
    const map = new Map<string, InventoryProductRow>();
    for (const product of loadedProducts) {
      map.set(product.id, productToInventoryRow(product));
    }
    return map;
  }, [loadedProducts]);

  const openStockDialog = useCallback(async (product: Product) => {
    const fresh = await fetchProductById(product.id);
    setStockDialogProduct(
      fresh ? productToInventoryRow(fresh) : inventoryRowsById.get(product.id) ?? productToInventoryRow(product)
    );
    setStockDialogOpen(true);
  }, [inventoryRowsById]);

  const handleStockRestock = useCallback(
    async (productId: string, addAmount: number, minLevel: number) => {
      if (!user?.id) return;

      const current = inventoryRowsById.get(productId);
      if (!current) {
        toast.error('المنتج غير موجود');
        return;
      }

      setStockSaving(true);
      try {
        const { added, newQuantity } = await restockProduct({
          product: current,
          ownerId: user.id,
          addAmount,
          minLevel,
        });

        toast.success(
          added > 0 ? `تمت إضافة ${added} وحدة للمخزون` : 'تم تحديث الحد الأدنى للتنبيه'
        );
        patchMerchantStockInCache(user.id, productId, newQuantity);
        catalog.syncFromCache();
        setStockDialogOpen(false);
        setStockDialogProduct(null);
      } catch (error) {
        console.error('Error restocking:', error);
        toast.error(
          error instanceof InventoryRestockError ? error.message : 'خطأ في تحديث المخزون'
        );
      } finally {
        setStockSaving(false);
      }
    },
    [user?.id, inventoryRowsById, catalog]
  );

  const handleSaveVariantStock = useCallback(
    async (productId: string, variants: ProductVariant[], minLevel: number) => {
      setStockSaving(true);
      try {
        const result = await updateProduct(productId, {
          variants,
          stockQuantity: variantStockSum(variants),
          lowStockThreshold: minLevel,
        });

        if (!result.success) {
          toast.error(result.error || 'فشل تحديث مخزون التركيبات');
          return;
        }

        toast.success('تم تحديث مخزون كل تركيبة');
        await reloadCatalog();
        setStockDialogOpen(false);
        setStockDialogProduct(null);
      } catch (error) {
        console.error('Error saving variant stock:', error);
        toast.error('خطأ في تحديث مخزون التركيبات');
      } finally {
        setStockSaving(false);
      }
    },
    [reloadCatalog]
  );

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
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
        description="أضف وعدّل منتجات متجرك وتابع المخزون من مكان واحد"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'المنتجات' }]}
        actions={headerActions}
      />

      <div className="ds-page max-w-6xl min-w-0">
          <div className="space-y-3 min-w-0 pb-6">
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
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 min-w-0">
              <StatCard
                label="متوفر"
                value={stats.inStock}
                icon={Package}
                iconClassName="bg-emerald-500/10 ring-emerald-500/15 [&_svg]:text-emerald-600"
                className="p-3 sm:p-5"
                onClick={() => updateFilters({ stock: 'in_stock', lifecycle: 'all' })}
                active={catalogFilters.stock === 'in_stock'}
              />
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
              />
            </section>

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

            {(stats.lowStock > 0 || stats.outOfStock > 0) && (
              <AttentionStrip
                attentionKey="low-stock"
                icon={AlertTriangle}
                message={
                  stats.outOfStock > 0
                    ? `${stats.outOfStock} نفد · ${stats.lowStock} منخفض — راجع الكميات وحدّث المخزون`
                    : `${stats.lowStock} ${stats.lowStock === 1 ? 'منتج' : 'منتجات'} بمخزون منخفض — حدّث الكميات من القائمة`
                }
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
              <div className="rounded-2xl border border-border/60 overflow-hidden bg-card">
                <div className="space-y-0">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 border-b border-border/30 bg-muted/30 animate-pulse" />
                  ))}
                </div>
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
                <ProductsDataTable
                  products={pagedVisibleProducts}
                  onDuplicate={handleDuplicate}
                  onPublish={handlePublish}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                  onRestock={openStockDialog}
                />

                {(hasMoreToRender || catalog.hasMore) && (
                  <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                    {hasMoreToRender && (
                      <Button variant="outline" className="rounded-xl" onClick={renderMore}>
                        عرض المزيد ({pagedVisibleProducts.length} / {visibleProducts.length})
                      </Button>
                    )}
                    {catalog.hasMore && (
                      <Button
                        variant="secondary"
                        className="rounded-xl"
                        disabled={catalog.loadingMore}
                        onClick={() => void catalog.loadMore()}
                      >
                        {catalog.loadingMore ? 'جاري التحميل…' : `تحميل صفحة إضافية (${loadedProducts.length} / ${catalog.total})`}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
      </div>

      <InventoryStockDialog
        open={stockDialogOpen}
        product={stockDialogProduct}
        saving={stockSaving}
        onOpenChange={(open) => {
          setStockDialogOpen(open);
          if (!open) setStockDialogProduct(null);
        }}
        onRestock={handleStockRestock}
        onSaveVariants={handleSaveVariantStock}
      />
    </DashboardLayout>
  );
};

export default Products;
