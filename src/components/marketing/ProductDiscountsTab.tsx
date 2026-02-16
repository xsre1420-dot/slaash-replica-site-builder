import { useState, useMemo, useCallback } from "react";
import { Plus, Tag, Trash2, Edit, CalendarIcon, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  discount_type?: 'none' | 'percentage' | 'amount';
  discount_value?: number;
  discount_start_date?: string;
  discount_end_date?: string;
  original_price?: number;
}

export default function ProductDiscountsTab() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    discount_type: 'none' as 'none' | 'percentage' | 'amount',
    discount_value: 0,
    discount_start_date: new Date(),
    discount_end_date: null as Date | null,
  });

  const loadProducts = useCallback(async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('products')
      .select('id, name, price, image_url, category, discount_type, discount_value, discount_start_date, discount_end_date, original_price')
      .eq('owner_id', user.id)
      .order('name', { ascending: true });
    if (!error) setProducts((data || []) as Product[]);
  }, [user]);

  useState(() => { loadProducts(); });

  const discountedProducts = useMemo(() =>
    products.filter(p => p.discount_type && p.discount_type !== 'none'), [products]);

  const stats = useMemo(() => ({
    total: products.length,
    discounted: discountedProducts.length,
    totalSavings: discountedProducts.reduce((sum, p) => sum + ((p.original_price || p.price) - p.price), 0),
  }), [products, discountedProducts]);

  const openDialog = (product?: Product) => {
    if (product) {
      setSelectedProduct(product);
      setDiscountForm({
        discount_type: (product.discount_type as 'none' | 'percentage' | 'amount') || 'none',
        discount_value: product.discount_value || 0,
        discount_start_date: product.discount_start_date ? new Date(product.discount_start_date) : new Date(),
        discount_end_date: product.discount_end_date ? new Date(product.discount_end_date) : null,
      });
    } else {
      setSelectedProduct(null);
      setDiscountForm({ discount_type: 'percentage', discount_value: 0, discount_start_date: new Date(), discount_end_date: null });
    }
    setIsDialogOpen(true);
  };

  const saveDiscount = async () => {
    if (!selectedProduct || !user) return;
    setLoading(true);

    const originalPrice = selectedProduct.original_price || selectedProduct.price;
    let newPrice = originalPrice;
    if (discountForm.discount_type === 'percentage') newPrice = originalPrice * (1 - discountForm.discount_value / 100);
    else if (discountForm.discount_type === 'amount') newPrice = originalPrice - discountForm.discount_value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      discount_type: discountForm.discount_type,
      discount_value: discountForm.discount_value,
      discount_start_date: discountForm.discount_start_date.toISOString(),
      discount_end_date: discountForm.discount_end_date?.toISOString() || null,
      price: newPrice,
    };
    if (discountForm.discount_type !== 'none' && !selectedProduct.original_price) updateData.original_price = originalPrice;
    if (discountForm.discount_type === 'none' && selectedProduct.original_price) updateData.original_price = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('products').update(updateData).eq('id', selectedProduct.id);
    if (error) toast.error("فشل في تحديث الخصم");
    else { toast.success(discountForm.discount_type === 'none' ? "تم إزالة الخصم" : "تم حفظ الخصم"); loadProducts(); setIsDialogOpen(false); setSelectedProduct(null); }
    setLoading(false);
  };

  const removeDiscount = async (product: Product) => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('products').update({
      discount_type: 'none', discount_value: 0, price: product.original_price || product.price, original_price: null,
    }).eq('id', product.id);
    if (!error) { toast.success("تم إزالة الخصم"); loadProducts(); }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي المنتجات", value: stats.total },
          { label: "منتجات مخصومة", value: stats.discounted },
          { label: "إجمالي التوفير", value: `${stats.totalSavings.toLocaleString()} د.ع` },
        ].map((s, i) => (
          <div key={s.label} className="bg-card/80 backdrop-blur-sm p-4 rounded-2xl border border-border/20 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Button onClick={() => openDialog()} className="rounded-xl">
          <Plus className="w-4 h-4 ml-2" /> إضافة خصم على منتج
        </Button>
      </div>

      {/* Discounted Products */}
      <Card className="border-border/20 rounded-2xl bg-card/80 backdrop-blur-sm">
        <CardContent className="p-0">
          {discountedProducts.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-4">لا توجد خصومات على المنتجات</p>
              <Button variant="outline" size="sm" onClick={() => openDialog()} className="rounded-xl">
                <Plus className="w-4 h-4 ml-2" /> إضافة خصم
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/10">
              {discountedProducts.map((product, i) => (
                <div key={product.id} className="p-4 hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => removeDiscount(product)} className="text-destructive hover:bg-destructive/10 rounded-xl h-8 w-8">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDialog(product)} className="rounded-xl h-8 w-8">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                      <div className="text-right min-w-0">
                        <h3 className="font-semibold text-sm text-foreground truncate">{product.name}</h3>
                        <div className="flex items-center gap-2 mt-1 justify-end">
                          <Badge variant="outline" className="text-[10px] rounded-lg bg-destructive/10 text-destructive border-destructive/20">
                            {product.discount_type === 'percentage' ? `${product.discount_value}%` : `${product.discount_value?.toLocaleString()} د.ع`}
                          </Badge>
                          <span className="text-xs line-through text-muted-foreground">{(product.original_price || product.price).toLocaleString()}</span>
                          <span className="text-sm font-bold text-foreground">{product.price.toLocaleString()} د.ع</span>
                        </div>
                        {product.discount_end_date && (
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                            <CalendarIcon className="w-3 h-3" />
                            حتى {new Date(product.discount_end_date).toLocaleDateString('ar-SA')}
                          </p>
                        )}
                      </div>
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-11 h-11 rounded-xl object-cover border border-border/10 flex-shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discount Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setSelectedProduct(null); }}>
        <DialogContent className="sm:max-w-[500px] text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right">
              {selectedProduct ? `${selectedProduct.name} - إدارة الخصم` : 'إضافة خصم على منتج'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!selectedProduct && (
              <div className="space-y-3">
                <Label className="font-semibold">اختر المنتج</Label>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {products.map((product) => (
                    <div key={product.id} onClick={() => { setSelectedProduct(product); if (product.discount_type && product.discount_type !== 'none') { setDiscountForm({ discount_type: product.discount_type, discount_value: product.discount_value || 0, discount_start_date: product.discount_start_date ? new Date(product.discount_start_date) : new Date(), discount_end_date: product.discount_end_date ? new Date(product.discount_end_date) : null }); } }}
                      className="flex items-center gap-3 p-3 border border-border/30 rounded-xl cursor-pointer transition-all hover:border-primary/40 hover:bg-muted/30">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-lg object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center"><Tag className="w-6 h-6 text-muted-foreground/40" /></div>
                      )}
                      <div className="flex-1 text-right">
                        <h4 className="font-semibold text-sm">{product.name}</h4>
                        <span className="text-sm font-bold text-foreground">{product.price.toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedProduct && (
              <>
                <div className="bg-muted/30 rounded-xl p-3 border border-border/20">
                  <div className="flex items-center gap-3">
                    {selectedProduct.image_url ? (
                      <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-14 h-14 rounded-lg object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center"><Tag className="w-6 h-6 text-muted-foreground/40" /></div>
                    )}
                    <div className="flex-1 text-right">
                      <h3 className="font-bold text-sm">{selectedProduct.name}</h3>
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        السعر: {(selectedProduct.original_price || selectedProduct.price).toLocaleString()} د.ع
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>نوع الخصم</Label>
                  <Select value={discountForm.discount_type} onValueChange={(v: 'none' | 'percentage' | 'amount') => setDiscountForm(p => ({ ...p, discount_type: v }))}>
                    <SelectTrigger className="rounded-xl text-right"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون خصم</SelectItem>
                      <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                      <SelectItem value="amount">مبلغ ثابت (د.ع)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {discountForm.discount_type !== 'none' && (
                  <>
                    <div className="space-y-2">
                      <Label>قيمة الخصم</Label>
                      <Input type="number" placeholder={discountForm.discount_type === 'percentage' ? '10' : '5000'} value={discountForm.discount_value || ''} onChange={(e) => setDiscountForm(p => ({ ...p, discount_value: Number(e.target.value) }))} className="text-right rounded-xl" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>تاريخ الانتهاء (اختياري)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-right font-normal rounded-xl", !discountForm.discount_end_date && "text-muted-foreground")}>
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {discountForm.discount_end_date ? format(discountForm.discount_end_date, "dd/MM/yyyy") : "بلا انتهاء"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={discountForm.discount_end_date || undefined} onSelect={(d) => setDiscountForm(p => ({ ...p, discount_end_date: d || null }))} className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>تاريخ البداية</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-right font-normal rounded-xl", !discountForm.discount_start_date && "text-muted-foreground")}>
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {format(discountForm.discount_start_date, "dd/MM/yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={discountForm.discount_start_date} onSelect={(d) => d && setDiscountForm(p => ({ ...p, discount_start_date: d }))} className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Price Preview */}
                    <div className="bg-muted/30 border border-border/20 rounded-xl p-3 text-sm">
                      <div className="flex justify-between items-center text-right">
                        <div>
                          <div className="text-muted-foreground text-xs">السعر بعد الخصم:</div>
                          <div className="text-lg font-bold text-foreground">
                            {discountForm.discount_type === 'percentage'
                              ? ((selectedProduct.original_price || selectedProduct.price) * (1 - discountForm.discount_value / 100)).toLocaleString()
                              : ((selectedProduct.original_price || selectedProduct.price) - discountForm.discount_value).toLocaleString()
                            } د.ع
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">السعر الأصلي:</div>
                          <div className="text-base line-through text-muted-foreground">
                            {(selectedProduct.original_price || selectedProduct.price).toLocaleString()} د.ع
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); setSelectedProduct(null); }} className="rounded-xl">إلغاء</Button>
            {selectedProduct && (
              <Button onClick={saveDiscount} disabled={loading} className="rounded-xl">
                {loading ? "جاري الحفظ..." : discountForm.discount_type === 'none' ? 'إزالة الخصم' : 'حفظ الخصم'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
