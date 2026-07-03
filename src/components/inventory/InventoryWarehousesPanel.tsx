import { useEffect, useState } from 'react';
import { Building2, Plus, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  fetchWarehouses,
  fetchWarehouseStock,
  type WarehouseRow,
} from '@/services/inventoryService';
import {
  createWarehouse,
  ensureDefaultWarehouse,
  transferWarehouseStock,
} from '@/services/inventoryService';
import type { InventoryProductRow } from '@/utils/inventoryPageUtils';

interface InventoryWarehousesPanelProps {
  ownerId: string;
  products: InventoryProductRow[];
  onRefresh: () => void;
}

const InventoryWarehousesPanel = ({ ownerId, products, onRefresh }: InventoryWarehousesPanelProps) => {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [stockPreview, setStockPreview] = useState<Array<{ product_id: string; quantity: number; products?: { name: string } }>>([]);

  const load = async () => {
    setLoading(true);
    await ensureDefaultWarehouse(ownerId);
    const wh = await fetchWarehouses(ownerId);
    setWarehouses(wh);
    if (wh[0]) {
      const stock = await fetchWarehouseStock(ownerId, wh[0].id);
      setStockPreview(stock.slice(0, 10));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [ownerId]);

  const handleAddWarehouse = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const id = await createWarehouse(ownerId, { name: newName.trim() });
    setSaving(false);
    if (!id) {
      toast.error('فشل إنشاء المستودع');
      return;
    }
    toast.success('تم إنشاء المستودع');
    setAddOpen(false);
    setNewName('');
    void load();
  };

  const handleTransfer = async () => {
    if (!fromWh || !toWh || !productId || qty <= 0) return;
    setSaving(true);
    try {
      await transferWarehouseStock({
        ownerId,
        productId,
        fromWarehouseId: fromWh,
        toWarehouseId: toWh,
        quantity: qty,
      });
      toast.success('تم النقل بنجاح');
      setTransferOpen(false);
      onRefresh();
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل النقل');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setTransferOpen(true)} disabled={warehouses.length < 2}>
          <ArrowLeftRight className="w-4 h-4" />
          نقل مخزون
        </Button>
        <Button type="button" size="sm" className="rounded-xl gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" />
          مستودع جديد
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {warehouses.map((wh) => (
          <div key={wh.id} className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3" dir="rtl">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{wh.name}</p>
                {wh.is_default && (
                  <span className="text-[10px] font-semibold text-primary">افتراضي</span>
                )}
                {wh.address && <p className="text-xs text-muted-foreground mt-1">{wh.address}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {stockPreview.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2 text-right">عينة من المخزون (المستودع الافتراضي)</p>
          <ul className="space-y-1">
            {stockPreview.map((s) => (
              <li key={s.product_id} className="flex justify-between text-sm text-right">
                <span className="tabular-nums font-semibold">{s.quantity}</span>
                <span className="truncate text-muted-foreground">{s.products?.name ?? s.product_id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl text-right">
          <DialogHeader>
            <DialogTitle>مستودع جديد</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="mb-2 block">الاسم</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-xl" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button className="rounded-xl" disabled={saving} onClick={() => void handleAddWarehouse()}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="rounded-2xl text-right sm:max-w-md">
          <DialogHeader>
            <DialogTitle>نقل بين المستودعات</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="mb-2 block">من</Label>
              <Select value={fromWh} onValueChange={setFromWh}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">إلى</Label>
              <Select value={toWh} onValueChange={setToWh}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">المنتج</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                <SelectContent>
                  {products.slice(0, 100).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">الكمية</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setTransferOpen(false)}>إلغاء</Button>
            <Button className="rounded-xl" disabled={saving} onClick={() => void handleTransfer()}>نقل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryWarehousesPanel;
