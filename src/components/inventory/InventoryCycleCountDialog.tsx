import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  fetchCycleCountLines,
  fetchOpenCycleCounts,
  type CycleCountLineRow,
} from '@/services/inventoryService';
import {
  completeCycleCount,
  startCycleCount,
  submitCycleCountLine,
} from '@/services/inventoryService';
import { toast } from 'sonner';

interface InventoryCycleCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  onComplete: () => void;
}

const InventoryCycleCountDialog = ({
  open,
  onOpenChange,
  ownerId,
  onComplete,
}: InventoryCycleCountDialogProps) => {
  const [countId, setCountId] = useState<string | null>(null);
  const [lines, setLines] = useState<CycleCountLineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyAdjustments, setApplyAdjustments] = useState(true);
  const [counts, setCounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const openCounts = await fetchOpenCycleCounts(ownerId);
      if (openCounts[0]) {
        setCountId(openCounts[0].id);
        setLines(await fetchCycleCountLines(openCounts[0].id, ownerId));
      } else {
        setCountId(null);
        setLines([]);
      }
    })();
  }, [open, ownerId]);

  const handleStart = async () => {
    setLoading(true);
    const id = await startCycleCount(ownerId);
    setLoading(false);
    if (!id) {
      toast.error('فشل بدء الجرد');
      return;
    }
    setCountId(id);
    setLines(await fetchCycleCountLines(id, ownerId));
    toast.success('بدأ الجرد');
  };

  const handleSaveLine = async (line: CycleCountLineRow) => {
    const raw = counts[line.id];
    const qty = raw === '' || raw == null ? NaN : Number(raw);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error('أدخل كمية صحيحة');
      return;
    }
    setLoading(true);
    try {
      const variance = await submitCycleCountLine(ownerId, line.id, qty, applyAdjustments);
      toast.success(variance !== 0 ? `فرق: ${variance}` : 'متطابق');
      if (countId) setLines(await fetchCycleCountLines(countId, ownerId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!countId) return;
    setLoading(true);
    try {
      await completeCycleCount(ownerId, countId);
      toast.success('اكتمل الجرد');
      onComplete();
      onOpenChange(false);
    } catch {
      toast.error('فشل إنهاء الجرد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl text-right sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            جرد المخزون
          </DialogTitle>
        </DialogHeader>

        {!countId ? (
          <div className="py-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">ابدأ جرداً جديداً لمقارنة الكميات الفعلية</p>
            <Button className="rounded-xl" disabled={loading} onClick={() => void handleStart()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              بدء الجرد
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3">
              <Switch checked={applyAdjustments} onCheckedChange={setApplyAdjustments} />
              <span className="text-sm">تطبيق الزيادة تلقائياً (لا خصم)</span>
            </label>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {lines.map((line) => (
                <li key={line.id} className="rounded-xl border border-border/40 p-3">
                  <p className="text-sm font-medium text-right mb-2">{line.products?.name ?? 'منتج'}</p>
                  <p className="text-[11px] text-muted-foreground text-right mb-2">متوقع: {line.expected_qty}</p>
                  <div className="flex gap-2 items-end">
                    <Button
                      size="sm"
                      className="rounded-xl h-9 shrink-0"
                      disabled={loading}
                      onClick={() => void handleSaveLine(line)}
                    >
                      حفظ
                    </Button>
                    <div className="flex-1">
                      <Label className="text-[10px]">العدد الفعلي</Label>
                      <Input
                        type="number"
                        min={0}
                        className="rounded-xl h-9"
                        value={counts[line.id] ?? line.counted_qty ?? ''}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [line.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {countId && (
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>إغلاق</Button>
            <Button className="rounded-xl" disabled={loading} onClick={() => void handleComplete()}>
              إنهاء الجرد
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InventoryCycleCountDialog;
