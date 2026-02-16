import { useState, useMemo, useCallback } from "react";
import { Plus, Gift, Trash2, Search, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_order_amount: number;
  usage_limit: number | null;
  used_count: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  description: string;
}

export default function CouponsTab() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: 0,
    minimum_order_amount: 0,
    usage_limit: null as number | null,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    description: ''
  });

  const loadCoupons = useCallback(async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('marketing_coupons')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setCoupons((data || []) as Coupon[]);
  }, [user]);

  // Load on mount
  useState(() => { loadCoupons(); });

  const filteredCoupons = useMemo(() =>
    coupons.filter(c =>
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase())
    ), [coupons, searchTerm]);

  const stats = useMemo(() => ({
    total: coupons.length,
    active: coupons.filter(c => c.is_active).length,
    totalUsage: coupons.reduce((sum, c) => sum + c.used_count, 0),
  }), [coupons]);

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("تم نسخ الكود");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddCoupon = async () => {
    if (!user || !newCoupon.code.trim() || !newCoupon.discount_value) {
      toast.error("يرجى إدخال جميع البيانات المطلوبة");
      return;
    }
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('marketing_coupons')
      .insert({
        owner_id: user.id,
        code: newCoupon.code.toUpperCase(),
        discount_type: newCoupon.discount_type,
        discount_value: newCoupon.discount_value,
        minimum_order_amount: newCoupon.minimum_order_amount,
        usage_limit: newCoupon.usage_limit,
        start_date: new Date(newCoupon.start_date).toISOString(),
        end_date: newCoupon.end_date ? new Date(newCoupon.end_date).toISOString() : null,
        description: newCoupon.description,
        is_active: true,
        used_count: 0
      });

    if (error) {
      toast.error(error.message.includes('duplicate') ? "كود الكوبون موجود مسبقاً" : "فشل في إضافة الكوبون");
    } else {
      toast.success("تمت إضافة الكوبون الجديد");
      loadCoupons();
      setIsAddOpen(false);
      setNewCoupon({ code: '', discount_type: 'percentage', discount_value: 0, minimum_order_amount: 0, usage_limit: null, start_date: new Date().toISOString().split('T')[0], end_date: '', description: '' });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('marketing_coupons').delete().eq('id', id);
    if (!error) { toast.success("تم حذف الكوبون"); loadCoupons(); }
    else toast.error("فشل في حذف الكوبون");
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('marketing_coupons').update({ is_active: !isActive }).eq('id', id);
    if (!error) { loadCoupons(); toast.success(`تم ${!isActive ? 'تفعيل' : 'إيقاف'} الكوبون`); }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي الكوبونات", value: stats.total },
          { label: "كوبونات نشطة", value: stats.active },
          { label: "مرات الاستخدام", value: stats.totalUsage },
        ].map((s, i) => (
          <div key={s.label} className="bg-card/80 backdrop-blur-sm p-4 rounded-2xl border border-border/20 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Add */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="البحث في الكوبونات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 rounded-xl border-border/30 bg-card/80"
          />
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="rounded-xl">
          <Plus className="w-4 h-4 ml-2" />
          إضافة كوبون
        </Button>
      </div>

      {/* Coupons List */}
      <Card className="border-border/20 rounded-2xl bg-card/80 backdrop-blur-sm">
        <CardContent className="p-0">
          {filteredCoupons.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm ? "لا توجد نتائج مطابقة" : "لا توجد كوبونات بعد"}
              </p>
              {!searchTerm && (
                <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)} className="rounded-xl">
                  <Plus className="w-4 h-4 ml-2" /> إضافة كوبون
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/10">
              {filteredCoupons.map((coupon, i) => (
                <div key={coupon.id} className="p-4 hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={coupon.is_active} onCheckedChange={() => handleToggle(coupon.id, coupon.is_active)} />
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(coupon.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl h-8 w-8">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={coupon.is_active ? "default" : "secondary"} className="text-[10px]">
                          {coupon.is_active ? "مفعل" : "موقف"}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleCopyCode(coupon.code, coupon.id)} className="p-1 rounded-md hover:bg-muted transition-colors">
                            {copiedId === coupon.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                          </button>
                          <code className="text-sm font-bold bg-muted px-2 py-0.5 rounded-lg">{coupon.code}</code>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{coupon.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {[
                      { label: "قيمة الخصم", value: coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${coupon.discount_value.toLocaleString()} د.ع` },
                      { label: "الحد الأدنى", value: `${coupon.minimum_order_amount.toLocaleString()} د.ع` },
                      { label: "الاستخدام", value: `${coupon.used_count} / ${coupon.usage_limit || '∞'}` },
                      { label: "الانتهاء", value: coupon.end_date ? new Date(coupon.end_date).toLocaleDateString('ar-SA') : 'بلا انتهاء' },
                    ].map(item => (
                      <div key={item.label} className="text-right">
                        <span className="text-muted-foreground block">{item.label}</span>
                        <span className="font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Coupon Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right">إضافة كوبون خصم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>كود الكوبون</Label>
              <Input placeholder="مثل: DISCOUNT20" value={newCoupon.code} onChange={(e) => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))} className="text-right rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>قيمة الخصم</Label>
                <Input type="number" placeholder="10" value={newCoupon.discount_value || ''} onChange={(e) => setNewCoupon(p => ({ ...p, discount_value: Number(e.target.value) }))} className="text-right rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>نوع الخصم</Label>
                <Select value={newCoupon.discount_type} onValueChange={(v: 'percentage' | 'fixed_amount') => setNewCoupon(p => ({ ...p, discount_type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                    <SelectItem value="fixed_amount">مبلغ ثابت (د.ع)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>حد الاستخدام (اختياري)</Label>
                <Input type="number" placeholder="100" value={newCoupon.usage_limit || ''} onChange={(e) => setNewCoupon(p => ({ ...p, usage_limit: e.target.value ? Number(e.target.value) : null }))} className="text-right rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى للطلب</Label>
                <Input type="number" placeholder="0" value={newCoupon.minimum_order_amount || 0} onChange={(e) => setNewCoupon(p => ({ ...p, minimum_order_amount: Number(e.target.value) }))} className="text-right rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>تاريخ الانتهاء (اختياري)</Label>
                <Input type="date" value={newCoupon.end_date} onChange={(e) => setNewCoupon(p => ({ ...p, end_date: e.target.value }))} className="text-right rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" value={newCoupon.start_date} onChange={(e) => setNewCoupon(p => ({ ...p, start_date: e.target.value }))} className="text-right rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>وصف الكوبون</Label>
              <Textarea placeholder="خصم 20% على جميع المنتجات" value={newCoupon.description} onChange={(e) => setNewCoupon(p => ({ ...p, description: e.target.value }))} className="text-right rounded-xl" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleAddCoupon} disabled={loading} className="rounded-xl">
              {loading ? "جاري الإضافة..." : "إضافة الكوبون"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
