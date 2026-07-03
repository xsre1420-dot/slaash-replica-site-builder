import { useEffect, useState } from 'react';
import { ClipboardList, PackagePlus, Plus } from 'lucide-react';
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
  fetchPurchaseOrders,
  fetchPurchaseOrderLines,
  fetchSuppliers,
  type PurchaseOrderLineRow,
  type PurchaseOrderRow,
  type SupplierRow,
} from '@/services/inventoryService';
import { createPurchaseOrder, createSupplier, receivePurchaseOrderLine } from '@/services/inventoryService';
import type { InventoryProductRow } from '@/utils/inventoryPageUtils';
import { cn } from '@/lib/utils';

const statusLabel: Record<string, string> = {
  draft: 'مسودة',
  ordered: 'مُطلَب',
  partial: 'استلام جزئي',
  received: 'مُستلَم',
  cancelled: 'ملغى',
};

interface InventoryPurchaseOrdersPanelProps {
  ownerId: string;
  products: InventoryProductRow[];
  onReceived: () => void;
}

const InventoryPurchaseOrdersPanel = ({
  ownerId,
  products,
  onReceived,
}: InventoryPurchaseOrdersPanelProps) => {
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<string | null>(null);
  const [lines, setLines] = useState<PurchaseOrderLineRow[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [lineProductId, setLineProductId] = useState('');
  const [lineQty, setLineQty] = useState(10);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [o, s] = await Promise.all([fetchPurchaseOrders(ownerId), fetchSuppliers(ownerId)]);
    setOrders(o);
    setSuppliers(s);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [ownerId]);

  useEffect(() => {
    if (!selectedPo) {
      setLines([]);
      return;
    }
    void fetchPurchaseOrderLines(selectedPo, ownerId).then(setLines);
  }, [selectedPo, ownerId]);

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    const id = await createSupplier(ownerId, { name: newSupplierName.trim() });
    if (!id) {
      toast.error('فشل إضافة المورد');
      return;
    }
    setSupplierId(id);
    setNewSupplierName('');
    void load();
    toast.success('تمت إضافة المورد');
  };

  const handleCreatePo = async () => {
    if (!lineProductId || lineQty <= 0) {
      toast.error('اختر منتجاً وكمية');
      return;
    }
    setSaving(true);
    const id = await createPurchaseOrder(ownerId, {
      supplierId: supplierId || undefined,
      lines: [{ productId: lineProductId, quantity: lineQty }],
    });
    setSaving(false);
    if (!id) {
      toast.error('فشل إنشاء أمر الشراء');
      return;
    }
    toast.success('تم إنشاء أمر الشراء');
    setCreateOpen(false);
    setSelectedPo(id);
    void load();
  };

  const handleReceive = async (line: PurchaseOrderLineRow) => {
    const remaining = line.quantity_ordered - line.quantity_received;
    if (remaining <= 0) return;
    setSaving(true);
    try {
      await receivePurchaseOrderLine(ownerId, line.id, remaining);
      toast.success(`تم استلام ${remaining} وحدة`);
      onReceived();
      if (selectedPo) {
        setLines(await fetchPurchaseOrderLines(selectedPo, ownerId));
      }
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الاستلام');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-48 rounded-2xl" />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <Button size="sm" className="rounded-xl gap-1.5 h-9" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            أمر شراء
          </Button>
          <h3 className="font-semibold text-sm">أوامر الشراء</h3>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-right py-6">لا توجد أوامر شراء</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {orders.map((po) => (
              <li key={po.id}>
                <button
                  type="button"
                  onClick={() => setSelectedPo(po.id)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2.5 text-right transition-colors',
                    selectedPo === po.id ? 'border-primary/40 bg-primary/5' : 'border-border/40 hover:bg-muted/30'
                  )}
                >
                  <p className="text-sm font-semibold">{po.reference_code ?? po.id.slice(0, 8)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {statusLabel[po.status] ?? po.status}
                    {po.suppliers?.name ? ` · ${po.suppliers.name}` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 justify-end mb-3">
          <h3 className="font-semibold text-sm">بنود الأمر</h3>
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
        </div>
        {!selectedPo ? (
          <p className="text-sm text-muted-foreground text-right py-6">اختر أمر شراء</p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-right py-6">لا توجد بنود</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => {
              const remaining = line.quantity_ordered - line.quantity_received;
              return (
                <li key={line.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/40 px-3 py-2.5" dir="rtl">
                  <div className="min-w-0 flex-1 text-right">
                    <p className="text-sm font-medium truncate">{line.products?.name ?? 'منتج'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {line.quantity_received}/{line.quantity_ordered} مستلم
                    </p>
                  </div>
                  {remaining > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 text-xs gap-1 shrink-0"
                      disabled={saving}
                      onClick={() => void handleReceive(line)}
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      استلام {remaining}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl text-right sm:max-w-md">
          <DialogHeader>
            <DialogTitle>أمر شراء جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="mb-2 block">المورد</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختياري" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="مورد جديد"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="rounded-xl flex-1"
                />
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void handleCreateSupplier()}>
                  إضافة
                </Button>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">المنتج</Label>
              <Select value={lineProductId} onValueChange={setLineProductId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {products.slice(0, 100).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">الكمية</Label>
              <Input type="number" min={1} value={lineQty} onChange={(e) => setLineQty(Number(e.target.value))} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button className="rounded-xl" disabled={saving} onClick={() => void handleCreatePo()}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPurchaseOrdersPanel;
