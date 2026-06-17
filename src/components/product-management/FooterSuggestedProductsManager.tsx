import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb, Package, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  addFooterSuggestedProduct,
  listFooterSuggestedForOwner,
  MAX_FOOTER_SUGGESTIONS,
  removeFooterSuggestedProduct,
  type FooterSuggestedRow,
} from '@/services/footerSuggestedProductsService';
import { loadAllMerchantProducts } from '@/services/productService';
import type { Product } from '@/types';
import { getProductLifecycleStatus } from '@/lib/productLifecycle';

const FooterSuggestedProductsManager = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<FooterSuggestedRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [footerRows, catalog] = await Promise.all([
        listFooterSuggestedForOwner(user.id),
        loadAllMerchantProducts(true),
      ]);
      setRows(footerRows);
      setProducts(catalog.products.filter((p) => getProductLifecycleStatus(p) === 'published'));
    } catch {
      toast.error('تعذّر تحميل المنتجات المقترحة للتذييل');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedIds = useMemo(() => new Set(rows.map((r) => r.product_id)), [rows]);

  const availableProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          !selectedIds.has(p.id) &&
          p.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
      ),
    [products, selectedIds, searchTerm]
  );

  const handleAdd = async (productId: string) => {
    if (!user?.id) return;
    try {
      await addFooterSuggestedProduct(user.id, productId, rows.length);
      toast.success('تمت إضافة المنتج إلى تذييل المتجر');
      setDialogOpen(false);
      setSearchTerm('');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذّر إضافة المنتج');
    }
  };

  const handleRemove = async (rowId: string) => {
    if (!user?.id) return;
    try {
      await removeFooterSuggestedProduct(rowId, user.id);
      toast.success('تم الحذف من التذييل');
      await reload();
    } catch {
      toast.error('تعذّر حذف المنتج');
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-right">
            <CardTitle className="flex items-center justify-end gap-2 text-base">
              <Lightbulb className="w-4 h-4 text-primary" />
              منتجات مقترحة في تذييل المتجر
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              تظهر للعملاء في أسفل صفحة المتجر — حتى {MAX_FOOTER_SUGGESTIONS} منتجات منشورة
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="rounded-xl gap-2 shrink-0"
                disabled={rows.length >= MAX_FOOTER_SUGGESTIONS}
              >
                <Plus className="w-4 h-4" />
                إضافة منتج
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg font-arabic">
              <DialogHeader>
                <DialogTitle className="text-right">اختر منتجاً للتذييل</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="footer-product-search" className="sr-only">
                    بحث
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="footer-product-search"
                      placeholder="ابحث عن منتج..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 text-right rounded-xl"
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2">
                  {availableProducts.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6">
                      لا توجد منتجات منشورة متاحة
                    </p>
                  ) : (
                    availableProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => void handleAdd(product.id)}
                        className="w-full flex items-center gap-3 rounded-xl border border-border/50 p-3 hover:bg-muted/40 transition-colors text-right"
                      >
                        {product.image ? (
                          <img
                            src={product.image}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-xs text-primary font-semibold">
                            {product.price.toLocaleString()} د.ع
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            لم تُضف منتجات مقترحة بعد — ستظهر في تذييل المتجر للعملاء
          </p>
        ) : (
          <div className="grid gap-2">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 p-3"
              >
                {row.product.image_url ? (
                  <img
                    src={row.product.image_url}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-sm font-medium truncate">{row.product.name}</p>
                  <p className="text-xs text-muted-foreground">ترتيب {index + 1}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="font-arabic">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-right">حذف من التذييل</AlertDialogTitle>
                      <AlertDialogDescription className="text-right">
                        إزالة «{row.product.name}» من المنتجات المقترحة في تذييل المتجر؟
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => void handleRemove(row.id)}
                      >
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FooterSuggestedProductsManager;
