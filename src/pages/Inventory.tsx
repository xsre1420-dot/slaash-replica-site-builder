import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Package,
  CheckCircle,
  Wallet,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import InventoryToolbar from '@/components/inventory/InventoryToolbar';
import InventoryProductCard from '@/components/inventory/InventoryProductCard';
import InventoryStockDialog from '@/components/inventory/InventoryStockDialog';
import InventoryAutoDeductionNotice from '@/components/inventory/InventoryAutoDeductionNotice';
import InventoryRichStatCard from '@/components/inventory/InventoryRichStatCard';
import InventoryQuickActions from '@/components/inventory/InventoryQuickActions';
import InventoryAlertsPanel from '@/components/inventory/InventoryAlertsPanel';
import InventoryInsightsPanel from '@/components/inventory/InventoryInsightsPanel';
import InventoryDataTable from '@/components/inventory/InventoryDataTable';
import InventoryBulkBar from '@/components/inventory/InventoryBulkBar';
import InventoryTabNav, { type InventoryTab } from '@/components/inventory/InventoryTabNav';
import InventoryMovementsPanel from '@/components/inventory/InventoryMovementsPanel';
import InventoryAnalyticsPanel from '@/components/inventory/InventoryAnalyticsPanel';
import InventoryWarehousesPanel from '@/components/inventory/InventoryWarehousesPanel';
import InventoryPurchaseOrdersPanel from '@/components/inventory/InventoryPurchaseOrdersPanel';
import InventoryBulkRestockDialog from '@/components/inventory/InventoryBulkRestockDialog';
import InventoryBarcodeDialog from '@/components/inventory/InventoryBarcodeDialog';
import InventoryCycleCountDialog from '@/components/inventory/InventoryCycleCountDialog';
import { useInventoryKeyboardShortcuts } from '@/hooks/useInventoryKeyboardShortcuts';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Product } from '@/types';
import { restockProduct, InventoryRestockError, auditInventoryIntegrity, fetchMerchantInventorySummary } from '@/services/inventoryService';
import { getProductLifecycleStatus } from '@/lib/productLifecycle';
import { useMerchantProductsPage } from '@/hooks/useMerchantProductsPage';
import { useProgressiveRender } from '@/hooks/useProgressiveRender';
import { patchMerchantStockInCache } from '@/services/productService';
import { useRealtimeProducts } from '@/hooks/useRealtimeProducts';
import AttentionStrip from '@/components/ui/AttentionStrip';
import { ATTENTION_PARAM } from '@/lib/attentionHighlight';
import { useSearchParams } from 'react-router-dom';
import {
  computeInventoryStats,
  computeInventoryAlerts,
  computeInventoryInsights,
  exportInventoryCsv,
  filterInventoryProducts,
  getInventoryStockStatus,
  getUniqueCategories,
  loadFilterPresets,
  loadRecentSearches,
  saveFilterPreset,
  saveRecentSearch,
  sortInventoryProducts,
  type InventoryAdvancedFilters,
  type InventoryAlert,
  type InventoryFilterPreset,
  type InventoryInsight,
  type InventoryProductRow,
  type InventorySort,
  type InventoryViewMode,
  type LifecycleFilter,
  type StockFilter,
} from '@/utils/inventoryPageUtils';

const mapCatalogToInventoryRows = (catalog: Product[]): InventoryProductRow[] =>
  catalog.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    cost: p.cost,
    sku: p.sku,
    barcode: p.barcode,
    category: p.category,
    image_url: p.image,
    stock_quantity: p.stockQuantity,
    min_stock_level: p.lowStockThreshold,
    sizes: p.sizes,
    colors: p.colors,
    variants: p.variants,
    created_at: (p as Product & { created_at?: string }).created_at || new Date().toISOString(),
    updated_at: (p as Product & { updated_at?: string }).updated_at,
    archived_at: p.archivedAt,
    lifecycle: getProductLifecycleStatus(p),
  }));

const DEFAULT_ADVANCED: InventoryAdvancedFilters = {
  hasImage: null,
  hasVariants: null,
  missingSku: false,
  priceMin: null,
  priceMax: null,
  qtyMin: null,
  qtyMax: null,
};

function Inventory() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const attentionApplied = useRef(false);
  const listRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeTab = (searchParams.get('tab') as InventoryTab) || 'overview';
  const setActiveTab = (tab: InventoryTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'overview') next.delete('tab');
      else next.set('tab', tab);
      return next;
    });
  };

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProductRow | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState<InventorySort>('stock_asc');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [viewMode, setViewMode] = useState<InventoryViewMode>('cards');
  const [advanced, setAdvanced] = useState<InventoryAdvancedFilters>(DEFAULT_ADVANCED);
  const [insightFilterIds, setInsightFilterIds] = useState<Set<string> | null>(null);
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [filterPresets, setFilterPresets] = useState<InventoryFilterPreset[]>(() => loadFilterPresets());
  const [integrityScore, setIntegrityScore] = useState<number | null>(null);
  const [integrityIssues, setIntegrityIssues] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkRestockOpen, setBulkRestockOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [cycleCountOpen, setCycleCountOpen] = useState(false);
  const [serverSummary, setServerSummary] = useState<{
    incomingUnits: number;
    reservedUnits: number;
  } | null>(null);

  const catalog = useMerchantProductsPage(debouncedSearch, 'all', { profile: 'inventory' });
  const loading = catalog.loading;

  const products = useMemo(
    () => mapCatalogToInventoryRows(catalog.products),
    [catalog.products]
  );

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const syncFromCacheRef = useRef(catalog.syncFromCache);
  syncFromCacheRef.current = catalog.syncFromCache;

  useRealtimeProducts(useCallback(() => {
    syncFromCacheRef.current();
  }, []));

  useEffect(() => {
    if (!user?.id) return;
    void auditInventoryIntegrity(user.id).then((result) => {
      if (!result) return;
      setIntegrityScore(result.score);
      setIntegrityIssues(result.issuesCount);
    });
    void fetchMerchantInventorySummary(user.id).then((summary) => {
      if (!summary) return;
      setServerSummary({
        incomingUnits: summary.incomingUnits,
        reservedUnits: summary.reservedUnits,
      });
    });
  }, [user?.id, catalog.products.length]);

  useEffect(() => {
    if (!debouncedSearch.trim()) return;
    saveRecentSearch(debouncedSearch);
    setRecentSearches(loadRecentSearches());
  }, [debouncedSearch]);

  const performRestock = useCallback(
    async (
      productId: string,
      addAmount: number,
      minLevel?: number,
      opts?: { successMessage?: string; closeDialog?: boolean }
    ) => {
      if (!user?.id) throw new Error('Not authenticated');

      const current = products.find((p) => p.id === productId);
      if (!current) throw new Error('Product not found');

      const { added, newQuantity } = await restockProduct({
        product: current,
        ownerId: user.id,
        addAmount,
        minLevel,
      });

      const message =
        opts?.successMessage ??
        (added > 0 ? `تمت إضافة ${added} وحدة للمخزون` : 'تم تحديث الحد الأدنى للتنبيه');

      toast.success(message);
      patchMerchantStockInCache(user.id, productId, newQuantity);
      catalog.syncFromCache();

      if (opts?.closeDialog !== false) {
        setDialogOpen(false);
        setSelectedProduct(null);
      }
    },
    [products, catalog, user?.id]
  );

  const handleDialogRestock = async (productId: string, addAmount: number, minLevel: number) => {
    setSaving(true);
    try {
      await performRestock(productId, addAmount, minLevel);
    } catch (error) {
      console.error('Error restocking:', error);
      toast.error(
        error instanceof InventoryRestockError ? error.message : 'خطأ في إعادة التعبئة'
      );
    } finally {
      setSaving(false);
    }
  };

  const categories = useMemo(() => getUniqueCategories(products), [products]);
  const stats = useMemo(() => computeInventoryStats(products), [products]);
  const alerts = useMemo(
    () => computeInventoryAlerts(products, integrityIssues),
    [products, integrityIssues]
  );
  const insights = useMemo(() => computeInventoryInsights(products), [products]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (advanced.hasImage != null) count += 1;
    if (advanced.hasVariants != null) count += 1;
    if (advanced.missingSku) count += 1;
    if (advanced.priceMin != null) count += 1;
    if (advanced.priceMax != null) count += 1;
    if (advanced.qtyMin != null) count += 1;
    if (advanced.qtyMax != null) count += 1;
    return count;
  }, [advanced]);

  const filteredProducts = useMemo(() => {
    const filtered = filterInventoryProducts(products, {
      search: debouncedSearch,
      stockFilter,
      category: categoryFilter,
      lifecycle: lifecycleFilter,
      lowStockOnly,
      advanced,
      productIds: insightFilterIds ?? undefined,
    });
    return sortInventoryProducts(filtered, sort);
  }, [
    products,
    debouncedSearch,
    stockFilter,
    categoryFilter,
    lifecycleFilter,
    lowStockOnly,
    advanced,
    insightFilterIds,
    sort,
  ]);

  const { visibleItems: visibleInventory, hasMore: hasMoreToRender, loadMore: renderMore } =
    useProgressiveRender(filteredProducts, viewMode === 'table' ? 100 : 48);

  const lowStockProducts = useMemo(
    () =>
      products.filter((p) => {
        const s = getInventoryStockStatus(p).status;
        return s === 'low' || s === 'out';
      }),
    [products]
  );

  useEffect(() => {
    if (searchParams.get(ATTENTION_PARAM) !== 'low-stock' || attentionApplied.current || loading) return;
    attentionApplied.current = true;
    const outCount = products.filter((p) => getInventoryStockStatus(p).status === 'out').length;
    const lowCount = products.filter((p) => getInventoryStockStatus(p).status === 'low').length;
    if (outCount > 0 && lowCount === 0) setStockFilter('out');
    else if (lowCount > 0) setStockFilter('low');
    setLowStockOnly(true);
  }, [searchParams, products, loading]);

  const downloadCsv = useCallback((rows: InventoryProductRow[], filename: string) => {
    if (rows.length === 0) {
      toast.error('لا توجد منتجات للتصدير');
      return;
    }
    const csv = exportInventoryCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${rows.length} منتج`);
  }, []);

  const exportCSV = () => downloadCsv(products, 'inventory.csv');

  const exportSelected = () => {
    const rows = products.filter((p) => selectedIds.has(p.id));
    downloadCsv(rows, 'inventory-selected.csv');
  };

  const openRestockDialog = (product: InventoryProductRow) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleReceiveStock = () => {
    const target = lowStockProducts[0];
    if (target) {
      openRestockDialog(target);
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    toast.info('لا توجد منتجات ناقصة حالياً');
  };

  const handleAlertAction = (alert: InventoryAlert) => {
    if (alert.filterKey === 'stock' && alert.filterValue) {
      setStockFilter(alert.filterValue as StockFilter);
      setLowStockOnly(false);
    } else if (alert.filterKey === 'lifecycle' && alert.filterValue) {
      setLifecycleFilter(alert.filterValue as LifecycleFilter);
    } else if (alert.filterKey === 'hasImage' && alert.filterValue === 'false') {
      setAdvanced((prev) => ({ ...prev, hasImage: false }));
    } else if (alert.filterKey === 'missingSku') {
      setAdvanced((prev) => ({ ...prev, missingSku: true }));
    }
    setInsightFilterIds(null);
    setActiveInsightId(null);
  };

  const handleFocusInsight = (insight: InventoryInsight) => {
    setActiveInsightId(insight.id);
    setInsightFilterIds(new Set(insight.productIds));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleInventory.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visibleInventory.map((p) => p.id)));
  };

  const handleBulkRestock = () => {
    const rows = products.filter((p) => selectedIds.has(p.id));
    if (rows.length === 0) return;
    if (rows.length === 1) {
      openRestockDialog(rows[0]);
      return;
    }
    setBulkRestockOpen(true);
  };

  const selectedForBulk = useMemo(
    () => products.filter((p) => selectedIds.has(p.id)),
    [products, selectedIds]
  );

  const handleSavePreset = () => {
    const name = window.prompt('اسم الفلتر المحفوظ');
    if (!name?.trim()) return;
    const preset: InventoryFilterPreset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      stockFilter,
      lifecycle: lifecycleFilter,
      category: categoryFilter,
      lowStockOnly,
      advanced: { ...advanced },
    };
    saveFilterPreset(preset);
    setFilterPresets(loadFilterPresets());
    toast.success('تم حفظ الفلتر');
  };

  const handleApplyPreset = (preset: InventoryFilterPreset) => {
    setStockFilter(preset.stockFilter);
    setLifecycleFilter(preset.lifecycle);
    setCategoryFilter(preset.category);
    setLowStockOnly(preset.lowStockOnly);
    setAdvanced({ ...DEFAULT_ADVANCED, ...preset.advanced });
    setInsightFilterIds(null);
    toast.success(`تم تطبيق: ${preset.name}`);
  };

  useInventoryKeyboardShortcuts({
    searchInputRef,
    onFocusSearch: () => setActiveTab('overview'),
    onBulkRestock: () => {
      if (selectedIds.size > 0) handleBulkRestock();
    },
    onExport: exportCSV,
  });

  if (loading) {
    return (
      <DashboardLayout>
        <PageHeader title="إدارة المخزون" hideBack breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'المخزون' }]} />
        <div className="flex items-center justify-center py-24">
          <div className="text-center animate-fade-in space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto px-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
            <p className="text-muted-foreground text-sm">جاري تحميل المخزون...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="إدارة المخزون"
        description="نظرة شاملة على المخزون — تعبئة، تنبيهات، وقيمة المخزون في مكان واحد"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'المخزون' }]}
      />

      <div className="ds-page space-y-5 sm:space-y-6 min-w-0 pb-24">
        <InventoryQuickActions
          onExport={exportCSV}
          onReceiveStock={handleReceiveStock}
          lowStockCount={lowStockProducts.length}
          onCycleCount={() => setCycleCountOpen(true)}
          onBarcodeScan={() => setBarcodeOpen(true)}
          onTransfer={() => setActiveTab('warehouses')}
          onPurchaseOrder={() => setActiveTab('orders')}
        />

        <InventoryTabNav active={activeTab} onChange={setActiveTab} />

        {activeTab === 'movements' && user?.id && (
          <InventoryMovementsPanel ownerId={user.id} />
        )}

        {activeTab === 'analytics' && user?.id && (
          <InventoryAnalyticsPanel
            ownerId={user.id}
            onRestockProduct={(productId) => {
              const row = productsById.get(productId);
              if (row) openRestockDialog(row);
            }}
          />
        )}

        {activeTab === 'warehouses' && user?.id && (
          <InventoryWarehousesPanel
            ownerId={user.id}
            products={products}
            onRefresh={() => catalog.syncFromCache()}
          />
        )}

        {activeTab === 'orders' && user?.id && (
          <InventoryPurchaseOrdersPanel
            ownerId={user.id}
            products={products}
            onReceived={() => catalog.syncFromCache()}
          />
        )}

        {activeTab === 'overview' && (
          <>
        <InventoryAutoDeductionNotice />

        <AttentionStrip
          attentionKey="low-stock"
          visible={lowStockProducts.length > 0}
          message={`${lowStockProducts.length} منتج بحاجة لإعادة تعبئة — اضغط «استلام مخزون» للبدء`}
        />

        <InventoryAlertsPanel
          alerts={alerts}
          integrityScore={integrityScore}
          onAlertAction={handleAlertAction}
        />

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <InventoryRichStatCard
            label="إجمالي المنتجات"
            value={stats.total}
            icon={Package}
            subItems={[
              { label: 'منشور', value: stats.published },
              { label: 'مسودة', value: stats.draft },
              { label: 'مؤرشف', value: stats.archived },
              { label: 'بمتغيرات', value: stats.withVariants },
            ]}
            onClick={() => {
              setStockFilter('all');
              setLifecycleFilter('all');
              setInsightFilterIds(null);
            }}
            active={stockFilter === 'all' && lifecycleFilter === 'all'}
          />
          <InventoryRichStatCard
            label="حالة المخزون"
            value={stats.good}
            icon={CheckCircle}
            iconClassName="bg-emerald-500/10 ring-emerald-500/15 [&_svg]:text-emerald-600"
            subItems={[
              { label: 'متوفر', value: stats.good },
              { label: 'منخفض', value: stats.low, highlight: stats.low > 0 },
              { label: 'نفد', value: stats.out, highlight: stats.out > 0 },
              { label: 'محجوز', value: serverSummary?.reservedUnits ?? '—', highlight: (serverSummary?.reservedUnits ?? 0) > 0 },
              { label: 'قادم', value: serverSummary?.incomingUnits ?? '—' },
              { label: 'إجمالي وحدات', value: stats.totalStock.toLocaleString() },
            ]}
            onClick={() => setStockFilter('good')}
            active={stockFilter === 'good'}
            subGridCols={3}
          />
          <InventoryRichStatCard
            label="قيمة المخزون (بيع)"
            value={`${stats.inventoryValue.toLocaleString()} د.ع`}
            icon={Wallet}
            iconClassName="bg-violet-500/10 ring-violet-500/15 [&_svg]:text-violet-600"
            subItems={[
              { label: 'تكلفة الشراء', value: stats.costValue > 0 ? `${stats.costValue.toLocaleString()} د.ع` : '—' },
              { label: 'ربح متوقع', value: stats.costValue > 0 ? `${stats.expectedProfit.toLocaleString()} د.ع` : '—' },
              {
                label: 'هامش الربح',
                value: stats.profitMargin != null ? `${stats.profitMargin}%` : 'أضف التكلفة',
              },
              { label: 'متوسط/منتج', value: stats.total ? Math.round(stats.inventoryValue / stats.total).toLocaleString() : 0 },
            ]}
          />
          <InventoryRichStatCard
            label="جودة البيانات"
            value={stats.missingSku + stats.missingImage}
            icon={BarChart3}
            iconClassName="bg-amber-500/10 ring-amber-500/15 [&_svg]:text-amber-600"
            subItems={[
              { label: 'بدون SKU', value: stats.missingSku, highlight: stats.missingSku > 0 },
              { label: 'بدون صورة', value: stats.missingImage, highlight: stats.missingImage > 0 },
              {
                label: 'سلامة السجل',
                value: integrityScore != null ? `${integrityScore}%` : '—',
              },
              { label: 'تنبيهات', value: alerts.length, highlight: alerts.length > 0 },
            ]}
            onClick={() => setAdvanced((prev) => ({ ...prev, missingSku: true }))}
          />
        </section>

        <InventoryInsightsPanel
          insights={insights}
          productsById={productsById}
          onSelectProduct={openRestockDialog}
          onFocusInsight={handleFocusInsight}
          activeInsightId={activeInsightId}
        />

        <InventoryToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          recentSearches={recentSearches}
          onRecentSearch={setSearchTerm}
          stockFilter={stockFilter}
          onStockFilterChange={(v) => {
            setStockFilter(v);
            setInsightFilterIds(null);
          }}
          lifecycleFilter={lifecycleFilter}
          onLifecycleFilterChange={setLifecycleFilter}
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
          categories={categories}
          sort={sort}
          onSortChange={setSort}
          lowStockOnly={lowStockOnly}
          onLowStockOnlyChange={setLowStockOnly}
          showLowStockToggle={lowStockProducts.length > 0}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          advanced={advanced}
          onAdvancedChange={(patch) => setAdvanced((prev) => ({ ...prev, ...patch }))}
          onClearAdvanced={() => setAdvanced(DEFAULT_ADVANCED)}
          filterPresets={filterPresets}
          onSavePreset={handleSavePreset}
          onApplyPreset={handleApplyPreset}
          activeFilterCount={activeFilterCount}
          searchInputRef={searchInputRef}
        />

        <section ref={listRef}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
            <div className="flex items-center gap-2">
              {insightFilterIds && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl h-8 text-xs"
                  onClick={() => {
                    setInsightFilterIds(null);
                    setActiveInsightId(null);
                  }}
                >
                  مسح فلتر الرؤى
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredProducts.length} من {products.length} منتج
            </p>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title={searchTerm || stockFilter !== 'all' || lowStockOnly ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات في المخزون'}
              description={products.length === 0 ? 'أضف منتجات من إدارة المنتجات لتظهر هنا' : 'جرّب تغيير البحث أو الفلتر'}
              actionLabel={products.length === 0 ? 'إضافة منتج' : undefined}
              actionHref={products.length === 0 ? '/add-product' : undefined}
            />
          ) : viewMode === 'table' ? (
            <>
              <InventoryDataTable
                products={visibleInventory}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                allSelected={selectedIds.size === visibleInventory.length && visibleInventory.length > 0}
                onRestock={openRestockDialog}
              />
              {(hasMoreToRender || catalog.hasMore) && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    className="rounded-xl min-h-[44px]"
                    disabled={catalog.loadingMore}
                    onClick={() => {
                      if (hasMoreToRender) renderMore();
                      else void catalog.loadMore();
                    }}
                  >
                    {catalog.loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-2.5 sm:gap-3">
              {visibleInventory.map((product) => (
                <InventoryProductCard
                  key={product.id}
                  product={product}
                  onRestock={openRestockDialog}
                />
              ))}
              {(hasMoreToRender || catalog.hasMore) && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    className="rounded-xl min-h-[44px]"
                    disabled={catalog.loadingMore}
                    onClick={() => {
                      if (hasMoreToRender) renderMore();
                      else void catalog.loadMore();
                    }}
                  >
                    {catalog.loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        <InventoryBulkBar
          selectedCount={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onExportSelected={exportSelected}
          onBulkRestock={handleBulkRestock}
        />
          </>
        )}
      </div>

      {user?.id && (
        <>
          <InventoryBulkRestockDialog
            open={bulkRestockOpen}
            onOpenChange={setBulkRestockOpen}
            ownerId={user.id}
            products={selectedForBulk}
            onComplete={() => {
              catalog.syncFromCache();
              setSelectedIds(new Set());
            }}
          />
          <InventoryBarcodeDialog
            open={barcodeOpen}
            onOpenChange={setBarcodeOpen}
            ownerId={user.id}
            products={products}
            onProductFound={openRestockDialog}
          />
          <InventoryCycleCountDialog
            open={cycleCountOpen}
            onOpenChange={setCycleCountOpen}
            ownerId={user.id}
            onComplete={() => catalog.syncFromCache()}
          />
        </>
      )}

      <InventoryStockDialog
        open={dialogOpen}
        product={selectedProduct}
        saving={saving}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedProduct(null);
        }}
        onRestock={handleDialogRestock}
      />
    </DashboardLayout>
  );
}

export default Inventory;
