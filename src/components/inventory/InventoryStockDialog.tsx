import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Package, PackagePlus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InventoryMovementHistory from '@/components/inventory/InventoryMovementHistory';
import { cn } from '@/lib/utils';
import {
  getAvailableQty,
  hasVariantOptions,
  hydrateProductVariantOptions,
  resolveProductVariantsForEdit,
  resolveVariantColorSwatch,
  variantStockSum,
} from '@/utils/inventoryUtils';
import {
  getInventoryStockStatus,
  getSuggestedRestockAmount,
  toInventoryProduct,
  type InventoryProductRow,
} from '@/utils/inventoryPageUtils';
import type { ProductVariant } from '@/types';

type InventoryStockDialogProps = {
  open: boolean;
  product: InventoryProductRow | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onRestock: (productId: string, addAmount: number, minLevel: number) => void;
  onSaveVariants?: (productId: string, variants: ProductVariant[], minLevel: number) => void;
};

const InventoryStockDialog = ({
  open,
  product,
  saving,
  onOpenChange,
  onRestock,
  onSaveVariants,
}: InventoryStockDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'restock' | 'history'>('restock');
  const [addAmount, setAddAmount] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [editableVariants, setEditableVariants] = useState<ProductVariant[]>([]);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const productId = product?.id ?? '';
  const preparedProduct = useMemo(() => {
    if (!product) return null;
    return hydrateProductVariantOptions(toInventoryProduct(product));
  }, [product]);
  const usesVariantStock = preparedProduct ? hasVariantOptions(preparedProduct) : false;
  const resolvedVariants = useMemo(
    () => (preparedProduct ? resolveProductVariantsForEdit(preparedProduct) : []),
    [preparedProduct]
  );

  useEffect(() => {
    if (!product || !open) return;
    setTab('restock');
    setAddAmount('');
    setMinLevel(String(product.min_stock_level ?? 5));
    setEditableVariants(resolvedVariants);
    const t = window.setTimeout(() => {
      if (!usesVariantStock) inputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [product, open, usesVariantStock, resolvedVariants]);

  const wasSaving = useRef(false);

  useEffect(() => {
    if (wasSaving.current && !saving) {
      setHistoryRefreshKey((k) => k + 1);
    }
    wasSaving.current = saving;
  }, [saving]);

  const parsedAdd = Math.max(0, parseInt(addAmount, 10) || 0);
  const parsedMin = Math.max(0, parseInt(minLevel, 10) || 0);
  const variantTotal = useMemo(() => variantStockSum(editableVariants), [editableVariants]);

  const productView = useMemo(() => {
    if (!product || !preparedProduct) return null;
    const availableNow = usesVariantStock
      ? variantTotal
      : getAvailableQty(preparedProduct);
    const stockStatus = getInventoryStockStatus(product);
    const suggested = getSuggestedRestockAmount(product);
    return {
      availableNow,
      stockStatus,
      suggested,
      projectedQty: (product.stock_quantity ?? 0) + parsedAdd,
    };
  }, [product, preparedProduct, usesVariantStock, variantTotal, parsedAdd]);

  if (!product || !productView) return null;

  const { availableNow, stockStatus, suggested, projectedQty } = productView;
  const needsAttention = stockStatus.status === 'low' || stockStatus.status === 'out';

  const stepAdd = (delta: number) => {
    setAddAmount(String(Math.max(0, parsedAdd + delta)));
  };

  const stepMin = (delta: number) => {
    setMinLevel(String(Math.max(0, parsedMin + delta)));
  };

  const updateVariantQty = (index: number, nextQty: number) => {
    setEditableVariants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(0, nextQty) };
      return next;
    });
  };

  const variantsChanged =
    usesVariantStock &&
    JSON.stringify(editableVariants) !== JSON.stringify(resolvedVariants);

  const minChanged = parsedMin !== (product.min_stock_level ?? 5);
  const canSave = usesVariantStock
    ? (variantsChanged || minChanged) && !!onSaveVariants
    : parsedAdd > 0 || minChanged;

  const handleSave = () => {
    if (usesVariantStock && onSaveVariants) {
      onSaveVariants(product.id, editableVariants, parsedMin);
      return;
    }
    onRestock(product.id, parsedAdd, parsedMin);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90dvh] overflow-hidden flex flex-col p-0 gap-0 [&>button:last-of-type]:hidden">
        <div className="relative shrink-0 border-b border-border/50 bg-muted/20 px-4 py-3.5 sm:px-5">
          <DialogClose className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </DialogClose>
          <DialogHeader>
            <div className="flex items-center gap-3 pe-8" dir="rtl">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover shrink-0 ring-1 ring-border/50"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted ring-1 ring-border/50">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1 text-right">
                <DialogTitle className="text-right text-sm sm:text-base leading-snug truncate">
                  {product.name}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">{product.category}</p>
              </div>
              <div className="shrink-0 text-left">
                <p className="text-[10px] text-muted-foreground">
                  {usesVariantStock ? 'المجموع' : 'المتوفر'}
                </p>
                <p
                  className={cn(
                    'text-lg font-bold tabular-nums leading-none',
                    stockStatus.status === 'out' && 'text-destructive',
                    stockStatus.status === 'low' && 'text-amber-600'
                  )}
                >
                  {availableNow}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3.5 sm:px-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'restock' | 'history')} dir="rtl">
            <TabsList className="grid w-full grid-cols-2 rounded-xl h-9">
              <TabsTrigger value="restock" className="rounded-lg text-xs">
                {usesVariantStock ? 'مخزون التركيبات' : 'إعادة تعبئة'}
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg text-xs">
                السجل
              </TabsTrigger>
            </TabsList>

            <TabsContent value="restock" className="space-y-3.5 mt-3.5 focus-visible:outline-none">
              {needsAttention && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 text-right rounded-lg bg-amber-500/10 px-2.5 py-2">
                  {stockStatus.status === 'out' ? 'نفد المخزون' : 'مخزون منخفض'}
                </p>
              )}

              {usesVariantStock ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    الكمية لكل لون ومقاس
                  </Label>
                  <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40 max-h-56 overflow-y-auto">
                    {editableVariants.map((variant, index) => {
                      const qty = variant.quantity ?? 0;
                      const { name: colorName, swatch: colorSwatch } = resolveVariantColorSwatch(
                        preparedProduct?.colors,
                        variant.color
                      );
                      return (
                        <div
                          key={`${variant.size}-${variant.color}-${index}`}
                          className="flex items-center gap-2 px-3 py-2 bg-card"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1" dir="rtl">
                            <span className="text-sm font-medium shrink-0 tabular-nums">
                              {variant.size || '—'}
                            </span>
                            {(colorSwatch || colorName) && (
                              <div className="flex items-center gap-1.5 min-w-0">
                                {colorSwatch && (
                                  <span
                                    className="h-5 w-5 rounded-full border border-border/60 shrink-0 ring-1 ring-border/20"
                                    style={{ backgroundColor: colorSwatch }}
                                    title={colorName}
                                    aria-label={colorName || 'لون'}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              disabled={qty <= 0}
                              onClick={() => updateVariantQty(index, qty - 1)}
                              aria-label="تقليل"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={qty || ''}
                              onChange={(e) =>
                                updateVariantQty(index, parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0)
                              }
                              className="h-8 w-14 rounded-lg text-center text-sm font-bold tabular-nums px-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => updateVariantQty(index, qty + 1)}
                              aria-label="زيادة"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right tabular-nums">
                    المجموع: {variantTotal} وحدة
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="inv-add" className="text-xs text-muted-foreground">
                    كمية الإضافة
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      disabled={parsedAdd <= 0}
                      onClick={() => stepAdd(-1)}
                      aria-label="تقليل"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      ref={inputRef}
                      id="inv-add"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value.replace(/[^\d]/g, ''))}
                      className="rounded-xl text-center text-lg font-bold tabular-nums h-10"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      onClick={() => stepAdd(1)}
                      aria-label="زيادة"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {needsAttention && parsedAdd === 0 && (
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline w-full text-right"
                      onClick={() => setAddAmount(String(suggested))}
                    >
                      استخدم الكمية المقترحة: +{suggested}
                    </button>
                  )}

                  {parsedAdd > 0 && (
                    <p className="text-[11px] text-emerald-600 font-medium text-right tabular-nums">
                      بعد التعبئة: {projectedQty} (+{parsedAdd})
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="inv-min" className="text-xs text-muted-foreground">
                  الحد الأدنى للتنبيه
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl shrink-0"
                    disabled={parsedMin <= 0}
                    onClick={() => stepMin(-1)}
                    aria-label="تقليل الحد الأدنى"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="inv-min"
                    type="text"
                    inputMode="numeric"
                    min="0"
                    value={minLevel}
                    onChange={(e) => setMinLevel(e.target.value.replace(/[^\d]/g, ''))}
                    className="rounded-xl text-center text-lg font-bold tabular-nums h-10"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl shrink-0"
                    onClick={() => stepMin(1)}
                    aria-label="زيادة الحد الأدنى"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                className="w-full rounded-xl min-h-[44px] gap-2"
                disabled={saving || !canSave}
                onClick={handleSave}
              >
                <PackagePlus className="h-4 w-4" />
                {saving
                  ? 'جاري الحفظ...'
                  : usesVariantStock
                    ? 'حفظ مخزون التركيبات'
                    : parsedAdd > 0
                      ? `تأكيد +${parsedAdd} وحدة`
                      : 'حفظ الحد الأدنى'}
              </Button>

              <p className="text-[10px] text-center text-muted-foreground">
                {usesVariantStock
                  ? 'عدّل كمية كل تركيبة — الخصم تلقائي عند الطلب'
                  : 'الخصم تلقائي عند الطلب'}
              </p>
            </TabsContent>

            <TabsContent value="history" className="focus-visible:outline-none">
              <InventoryMovementHistory
                productId={productId}
                active={tab === 'history' && open}
                refreshKey={historyRefreshKey}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryStockDialog;
