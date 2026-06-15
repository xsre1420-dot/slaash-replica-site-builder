import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Package, AlertTriangle, CheckCircle, Edit, Download, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Product, ProductVariant } from "@/types";
import { scaleVariantsToTotal } from "@/utils/inventoryUtils";
import { invalidateStorefrontForOwner } from "@/services/storefrontProductService";
import { loadAllMerchantProducts, invalidateProducts } from "@/services/productService";
import { getProductLifecycleStatus, lifecycleStatusLabel } from "@/lib/productLifecycle";
import { useRealtimeProducts } from '@/hooks/useRealtimeProducts';
import { useStoreHydration } from "@/context/StoreBootstrapContext";

type StockFilter = "all" | "good" | "low" | "out";

interface InventoryRow {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  variants?: ProductVariant[];
  created_at: string;
  lifecycle: ReturnType<typeof getProductLifecycleStatus>;
}

const stockFilters: { value: StockFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "الكل", icon: <Package className="w-3.5 h-3.5" /> },
  { value: "good", label: "متوفر", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { value: "low", label: "منخفض", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { value: "out", label: "نفد", icon: <XCircle className="w-3.5 h-3.5" /> },
];

function Inventory() {
  const { user } = useAuth();
  const { isReady, hydrationVersion } = useStoreHydration();
  const [products, setProducts] = useState<InventoryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<InventoryRow | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [minStockLevel, setMinStockLevel] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

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
          variants: p.variants,
          created_at: (p as Product & { created_at?: string }).created_at || new Date().toISOString(),
          lifecycle: getProductLifecycleStatus(p),
        }))
      );
    } catch (error) {
      console.error('Error fetching inventory products:', error);
      toast.error("خطأ في تحميل المنتجات");
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

  const updateStock = async (productId: string, quantity: number, minLevel?: number) => {
    try {
      if (!user?.id) throw new Error('Not authenticated');

      const current = products.find((p) => p.id === productId);
      const previousQty = current?.stock_quantity || 0;
      const delta = quantity - previousQty;

      const updateData: Record<string, unknown> = { stock_quantity: quantity };
      if (minLevel !== undefined) {
        updateData.min_stock_level = minLevel;
      }

      if (current?.variants?.length) {
        updateData.variants = scaleVariantsToTotal(current.variants, quantity);
      }

      const { error } = await (supabase as any)
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .eq('owner_id', user.id);

      if (error) throw error;

      if (delta !== 0) {
        await (supabase as any).from('inventory_movements').insert({
          product_id: productId,
          owner_id: user.id,
          quantity_delta: delta,
          reason: 'manual_adjustment',
        });
      }

      toast.success("تم تحديث المخزون بنجاح");
      void invalidateStorefrontForOwner(user.id);
      await reloadInventory();
      setDialogOpen(false);
      setSelectedProduct(null);
      setNewQuantity("");
      setMinStockLevel("");
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error("خطأ في تحديث المخزون");
    }
  };

  const getStockStatus = (product: InventoryRow) => {
    const quantity = product.stock_quantity || 0;
    const minLevel = product.min_stock_level || 5;

    if (quantity === 0) return { status: 'out' as const, label: 'نفد المخزون' };
    if (quantity <= minLevel) return { status: 'low' as const, label: 'مخزون منخفض' };
    return { status: 'good' as const, label: 'متوفر' };
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        product.category.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesFilter = stockFilter === "all" || getStockStatus(product).status === stockFilter;
      return matchesSearch && matchesFilter;
    });
  }, [products, debouncedSearch, stockFilter]);

  const stats = useMemo(() => ({
    total: products.length,
    good: products.filter((p) => getStockStatus(p).status === 'good').length,
    low: products.filter((p) => getStockStatus(p).status === 'low').length,
    out: products.filter((p) => getStockStatus(p).status === 'out').length,
    totalStock: products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0),
  }), [products]);

  const lowStockProducts = useMemo(
    () =>
      products.filter((p) => {
        const s = getStockStatus(p);
        return s.status === 'low' || s.status === 'out';
      }),
    [products]
  );

  const exportCSV = () => {
    if (products.length === 0) {
      toast.error("لا توجد منتجات للتصدير");
      return;
    }
    const headers = ["اسم المنتج", "التصنيف", "السعر", "الكمية", "الحد الأدنى", "الحالة", "حالة النشر"];
    const rows = products.map((p) => {
      const s = getStockStatus(p);
      return [p.name, p.category, p.price, p.stock_quantity || 0, p.min_stock_level || 5, s.label, lifecycleStatusLabel[p.lifecycle]];
    });
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير البيانات بنجاح");
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'out': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'low': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default: return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  const lifecycleBadgeClasses = (lifecycle: InventoryRow['lifecycle']) => {
    switch (lifecycle) {
      case 'archived': return 'bg-muted text-muted-foreground border-border';
      case 'draft': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      default: return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    }
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
        description="تتبع وإدارة مخزون جميع منتجاتك (منشورة، مسودة، ومؤرشفة)"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'المخزون' }]}
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV} className="rounded-xl min-h-[44px]">
            <Download className="w-4 h-4 ml-2" />
            تصدير
          </Button>
        }
      />

      <div className="ds-page">
        {lowStockProducts.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">
                تنبيه: {lowStockProducts.length} منتج بحاجة لإعادة تعبئة
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="إجمالي المنتجات" value={stats.total} icon={Package} />
          <StatCard label="متوفر" value={stats.good} icon={CheckCircle} iconClassName="bg-emerald-500/10 [&_svg]:text-emerald-600" />
          <StatCard label="منخفض" value={stats.low} icon={AlertTriangle} iconClassName="bg-amber-500/10 [&_svg]:text-amber-600" />
          <StatCard label="نفد" value={stats.out} icon={XCircle} iconClassName="bg-destructive/10 [&_svg]:text-destructive" />
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="بحث في المخزون..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 rounded-xl"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {stockFilters.map((f) => (
                <Button
                  key={f.value}
                  variant={stockFilter === f.value ? "default" : "outline"}
                  size="sm"
                  className={`rounded-xl gap-1.5 ${stockFilter !== f.value ? 'border-border/30 bg-card/80' : ''}`}
                  onClick={() => setStockFilter(f.value)}
                >
                  {f.icon}
                  {f.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title={searchTerm || stockFilter !== "all" ? "لا توجد نتائج مطابقة" : "لا توجد منتجات في المخزون"}
            description={products.length === 0 ? "أضف منتجات من إدارة المنتجات لتظهر هنا" : "جرّب تغيير البحث أو الفلتر"}
            actionLabel={products.length === 0 ? "إضافة منتج" : undefined}
            actionHref={products.length === 0 ? "/add-product" : undefined}
          />
        ) : (
          <div className="grid gap-3">
            {filteredProducts.map((product) => {
              const stockStatus = getStockStatus(product);
              return (
                <Card key={product.id} className="overflow-hidden">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 text-right flex-1">
                        <div className="flex flex-wrap items-center gap-2 justify-end mb-1">
                          <Badge variant="outline" className={`text-[10px] ${lifecycleBadgeClasses(product.lifecycle)}`}>
                            {lifecycleStatusLabel[product.lifecycle]}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${getStatusBadgeClasses(stockStatus.status)}`}>
                            {stockStatus.label}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">الكمية</p>
                        <p className="text-lg font-bold">{product.stock_quantity || 0}</p>
                      </div>
                      <Dialog open={dialogOpen && selectedProduct?.id === product.id} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => {
                              setSelectedProduct(product);
                              setNewQuantity(String(product.stock_quantity || 0));
                              setMinStockLevel(String(product.min_stock_level || 5));
                            }}
                          >
                            <Edit className="w-4 h-4 ml-1" />
                            تعديل
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-right">تحديث مخزون {product.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>الكمية</Label>
                              <Input type="number" min="0" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className="mt-1 rounded-xl" />
                            </div>
                            <div>
                              <Label>الحد الأدنى للتنبيه</Label>
                              <Input type="number" min="0" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} className="mt-1 rounded-xl" />
                            </div>
                            <Button
                              className="w-full rounded-xl"
                              onClick={() => updateStock(product.id, parseInt(newQuantity) || 0, parseInt(minStockLevel) || 5)}
                            >
                              حفظ
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Inventory;
