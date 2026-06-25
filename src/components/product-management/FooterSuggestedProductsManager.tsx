import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Package, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { loadProductsPage, getProductsSync, PRODUCTS_PAGE_SIZE } from '@/services/productService';
import type { Product } from '@/types';
import { getProductLifecycleStatus } from '@/lib/productLifecycle';

const remainingProductsPhrase = (count: number): string => {
  if (count === 1) return 'منتج واحد آخر';
  if (count === 2) return 'منتجين آخرين';
  return `${count} منتجات أخرى`;
};

const FooterSuggestedProductsManager = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<FooterSuggestedRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const publishedFromCatalog = useCallback(
    (catalog: Product[]) => catalog.filter((p) => getProductLifecycleStatus(p) === 'published'),
    []
  );

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const footerRows = await listFooterSuggestedForOwner(user.id);
      setRows(footerRows);
      const cached = getProductsSync();
      if (cached.length > 0) {
        setProducts(publishedFromCatalog(cached));
      }
    } catch {
      toast.error('تعذّر تحميل قائمة المنتجات المقترَحة');
    } finally {
      setLoading(false);
    }
  }, [publishedFromCatalog, user?.id]);

  const loadPickerCatalog = useCallback(async () => {
    if (!user?.id) return;
    const cached = getProductsSync();
    if (cached.length > 0) {
      setProducts(publishedFromCatalog(cached));
      return;
    }
    try {
      const combined: Product[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore && page < 20) {
        const result = await loadProductsPage(page, PRODUCTS_PAGE_SIZE, false, undefined, undefined, 'grid');
        combined.push(...result.products);
        hasMore = result.hasMore;
        page += 1;
      }
      setProducts(publishedFromCatalog(combined));
    } catch {
      toast.error('تعذّر تحميل قائمة المنتجات');
    }
  }, [publishedFromCatalog, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (dialogOpen) void loadPickerCatalog();
  }, [dialogOpen, loadPickerCatalog]);

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

  const slotsRemaining = MAX_FOOTER_SUGGESTIONS - rows.length;
  const isFull = rows.length >= MAX_FOOTER_SUGGESTIONS;

  const handleAdd = async (productId: string) => {
    if (!user?.id) return;
    try {
      await addFooterSuggestedProduct(user.id, productId, rows.length);
      toast.success('تمت الإضافة — سيظهر المنتج في أسفل متجرك');
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
      toast.success('تمت إزالة المنتج من قائمة أسفل المتجر');
      await reload();
    } catch {
      toast.error('تعذّر حذف المنتج');
    }
  };

  return (
    <section
      className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden min-w-0"
      dir="rtl"
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border/40 bg-gradient-to-l from-primary/[0.04] to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
              <LayoutGrid className="h-5 w-5 text-primary" strokeWidth={2} />
            </div>
            <div className="min-w-0 text-right flex-1">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  منتجات مقترَحة في أسفل المتجر
                </h3>
                <Badge variant="secondary" className="rounded-lg text-[10px] tabular-nums px-2">
                  {rows.length} من {MAX_FOOTER_SUGGESTIONS}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed max-w-xl mr-auto">
                حدّد حتى {MAX_FOOTER_SUGGESTIONS} منتجات منشورة تظهر للزوار في قسم «منتجات
                مقترَحة» أسفل صفحة متجرك — لزيادة فرص البيع الإضافية.
              </p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="rounded-xl gap-2 shrink-0 w-full sm:w-auto min-h-[40px]"
                disabled={isFull}
              >
                <Plus className="w-4 h-4" />
                {isFull ? 'اكتمل الحد الأقصى' : 'إضافة منتج'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg font-arabic rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-right text-base">اختر منتجاً للعرض</DialogTitle>
                <p className="text-xs text-muted-foreground text-right pt-1 leading-relaxed">
                  المنتجات المنشورة فقط · {remainingProductsPhrase(slotsRemaining)} متبقٍ
                </p>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="footer-product-search" className="sr-only">
                    بحث
                  </Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="footer-product-search"
                      placeholder="ابحث باسم المنتج..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10 text-right rounded-xl min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2">
                  {availableProducts.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      {products.length === 0
                        ? 'لا توجد منتجات منشورة. انشر منتجاً أولاً.'
                        : 'لا توجد نتائج، أو أن جميع المنتجات مضافة بالفعل.'}
                    </p>
                  ) : (
                    availableProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => void handleAdd(product.id)}
                        className="w-full flex items-center gap-3 rounded-xl border border-border/50 p-3 hover:bg-muted/40 hover:border-primary/20 transition-colors text-right"
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
                          <p className="text-xs text-primary font-semibold tabular-nums">
                            {product.price.toLocaleString()} د.ع
                          </p>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 sm:py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">لم تُضف أي منتج بعد</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
              اضغط «إضافة منتج» واختر المنتجات التي تريد إبرازها في أسفل صفحة متجرك.
            </p>
            {!isFull && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl mt-4 gap-2 min-h-[40px]"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="w-4 h-4" />
                إضافة أول منتج
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground mb-2 px-0.5">
              ترتيب الظهور للزوار (من الأعلى إلى الأسفل)
            </p>
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3 hover:border-border/80 transition-colors"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
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
                  <p className="text-xs text-muted-foreground">يُعرض في أسفل المتجر</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10"
                      aria-label="إزالة من قائمة أسفل المتجر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="font-arabic rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-right">إزالة من القائمة؟</AlertDialogTitle>
                      <AlertDialogDescription className="text-right leading-relaxed">
                        لن يظهر «{row.product.name}» للزوار في أسفل المتجر، لكنه يبقى منشوراً في
                        متجرك.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-xl bg-destructive hover:bg-destructive/90"
                        onClick={() => void handleRemove(row.id)}
                      >
                        إزالة
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
            {!isFull && (
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                يمكنك إضافة {remainingProductsPhrase(slotsRemaining)}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default FooterSuggestedProductsManager;
