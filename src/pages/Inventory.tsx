import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Download,
  XCircle,
  Boxes,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import InventoryToolbar from '@/components/inventory/InventoryToolbar';
import InventoryProductCard from '@/components/inventory/InventoryProductCard';
import InventoryStockDialog from '@/components/inventory/InventoryStockDialog';
import InventoryAutoDeductionNotice from '@/components/inventory/InventoryAutoDeductionNotice';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Product } from '@/types';
import { restockProduct, InventoryRestockError } from '@/services/inventoryService';
import { getProductLifecycleStatus, lifecycleStatusLabel } from '@/lib/productLifecycle';
import { loadAllMerchantProducts, syncMerchantProductCatalog, invalidateProducts } from '@/services/productService';
import { useRealtimeProducts } from '@/hooks/useRealtimeProducts';
import { useStoreHydration } from '@/context/StoreBootstrapContext';
import AttentionStrip from '@/components/ui/AttentionStrip';
import { ATTENTION_PARAM } from '@/lib/attentionHighlight';
import { useSearchParams } from 'react-router-dom';
import {
  computeInventoryStats,
  filterInventoryProducts,
  getInventoryStockStatus,
  getUniqueCategories,
  sortInventoryProducts,
  type InventoryProductRow,
  type InventorySort,
  type LifecycleFilter,
  type StockFilter,
} from '@/utils/inventoryPageUtils';

function Inventory() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const attentionApplied = useRef(false);
  const { isReady, hydrationVersion } = useStoreHydration();
  const [products, setProducts] = useState<InventoryProductRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<InventoryProductRow | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState<InventorySort>('stock_asc');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reloadInventory = useCallback(async () => {
    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await invalidateProducts();
      const { products: catalog } = await loadAllMerchantProducts(true);
      setProducts(
        catalog.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category,
          image_url: p.image,
          stock_quantity: p.stockQuantity,
          min_stock_level: p.lowStockThreshold,
          sizes: p.sizes,
          colors: p.colors,
          variants: p.variants,
          created_at: (p as Product & { created_at?: string }).created_at || new Date().toISOString(),
          lifecycle: getProductLifecycleStatus(p),
        }))
      );
    } catch (error) {
      console.error('Error fetching inventory products:', error);
      toast.error('خطأ في تحميل المنتجات');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    void reloadInventory();
  }, [isReady, hydrationVersion, reloadInventory, user?.id]);

  useRealtimeProducts(() => {
    void reloadInventory();
  });

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

      const { added } = await restockProduct({
        product: current,
        ownerId: user.id,
        addAmount,
        minLevel,
      });

      const message =
        opts?.successMessage ??
        (added > 0 ? `تمت إضافة ${added} وحدة للمخزون` : 'تم تحديث الحد الأدنى للتنبيه');

      toast.success(message);
      syncMerchantProductCatalog(user.id);
      await reloadInventory();

      if (opts?.closeDialog !== false) {
        setDialogOpen(false);
        setSelectedProduct(null);
      }
    },
    [products, reloadInventory, user?.id]
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

  const filteredProducts = useMemo(() => {
    const filtered = filterInventoryProducts(products, {
      search: debouncedSearch,
      stockFilter,
      category: categoryFilter,
      lifecycle: lifecycleFilter,
      lowStockOnly,
    });
    return sortInventoryProducts(filtered, sort);
  }, [products, debouncedSearch, stockFilter, categoryFilter, lifecycleFilter, lowStockOnly, sort]);

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

  const exportCSV = () => {
    if (products.length === 0) {
      toast.error('لا توجد منتجات للتصدير');
      return;
    }
    const headers = ['اسم المنتج', 'التصنيف', 'السعر', 'الكمية', 'الحد الأدنى', 'الحالة', 'حالة النشر'];
    const rows = products.map((p) => {
      const s = getInventoryStockStatus(p);
      return [
        p.name,
        p.category,
        p.price,
        p.stock_quantity || 0,
        p.min_stock_level || 5,
        s.label,
        lifecycleStatusLabel[p.lifecycle],
      ];
    });
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير البيانات بنجاح');
  };

  const openRestockDialog = (product: InventoryProductRow) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageHeader title="إدارة المخزون" hideBack breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'المخزون' }]} />
        <div className="flex items-center justify-center py-24">
          <div className="text-center animate-fade-in">
            <Package className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">جاري تحميل المخزون...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="إدارة المخزون"
        description="يُخصم المخزون تلقائياً عند الطلب — أضف كميات جديدة من هنا عند إعادة التعبئة"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'المخزون' }]}
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV} className="rounded-xl min-h-[44px]">
            <Download className="w-4 h-4 ml-2" />
            تصدير
          </Button>
        }
      />

      <div className="ds-page space-y-5 sm:space-y-6">
        <InventoryAutoDeductionNotice />

        <AttentionStrip
          attentionKey="low-stock"
          visible={lowStockProducts.length > 0}
          message={`${lowStockProducts.length} منتج بحاجة لإعادة تعبئة`}
        />

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="إجمالي المنتجات"
            value={stats.total}
            icon={Package}
            onClick={() => setStockFilter('all')}
            active={stockFilter === 'all'}
          />
          <StatCard
            label="متوفر"
            value={stats.good}
            icon={CheckCircle}
            iconClassName="bg-emerald-500/10 ring-emerald-500/15 [&_svg]:text-emerald-600"
            onClick={() => setStockFilter('good')}
            active={stockFilter === 'good'}
          />
          <StatCard
            label="منخفض"
            value={stats.low}
            icon={AlertTriangle}
            iconClassName="bg-amber-500/10 ring-amber-500/15 [&_svg]:text-amber-600"
            onClick={() => setStockFilter('low')}
            active={stockFilter === 'low'}
          />
          <StatCard
            label="نفد"
            value={stats.out}
            icon={XCircle}
            iconClassName="bg-destructive/10 ring-destructive/15 [&_svg]:text-destructive"
            onClick={() => setStockFilter('out')}
            active={stockFilter === 'out'}
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <StatCard
            label="إجمالي الوحدات"
            value={stats.totalStock.toLocaleString()}
            icon={Boxes}
            iconClassName="bg-primary/10 ring-primary/15 [&_svg]:text-primary"
          />
          <StatCard
            label="قيمة المخزون (د.ع)"
            value={stats.inventoryValue.toLocaleString()}
            icon={Wallet}
            iconClassName="bg-violet-500/10 ring-violet-500/15 [&_svg]:text-violet-600"
          />
        </section>

        <InventoryToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          stockFilter={stockFilter}
          onStockFilterChange={setStockFilter}
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
        />

        <section>
          <div className="flex items-center justify-between mb-3 px-1">
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
          ) : (
            <div className="grid gap-2.5 sm:gap-3">
              {filteredProducts.map((product) => (
                <InventoryProductCard
                  key={product.id}
                  product={product}
                  onRestock={openRestockDialog}
                />
              ))}
            </div>
          )}
        </section>
      </div>

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
