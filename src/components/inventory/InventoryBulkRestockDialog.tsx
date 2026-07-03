import { useState } from 'react';
import { PackagePlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { batchRestockWithSuggestions } from '@/services/inventoryService';
import type { InventoryProductRow } from '@/utils/inventoryPageUtils';
import { getSuggestedRestockAmount } from '@/utils/inventoryPageUtils';

interface InventoryBulkRestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  products: InventoryProductRow[];
  onComplete: () => void;
}

const InventoryBulkRestockDialog = ({
  open,
  onOpenChange,
  ownerId,
  products,
  onComplete,
}: InventoryBulkRestockDialogProps) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ succeeded: number; failed: number } | null>(null);

  const totalUnits = products.reduce((sum, p) => sum + getSuggestedRestockAmount(p), 0);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await batchRestockWithSuggestions(ownerId, products);
      setResult(res);
      onComplete();
    } finally {
      setRunning(false);
    }
  };

  const handleClose = () => {
    if (running) return;
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl text-right sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تعبئة جماعية</DialogTitle>
          <DialogDescription className="text-right">
            {products.length} منتج · ~{totalUnits} وحدة مقترحة
          </DialogDescription>
        </DialogHeader>

        {running && (
          <div className="py-4 space-y-2">
            <Progress value={66} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">جاري التعبئة...</p>
          </div>
        )}

        {result && !running && (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center">
            <p className="text-sm font-semibold text-emerald-600">{result.succeeded} نجح</p>
            {result.failed > 0 && (
              <p className="text-sm text-destructive mt-1">{result.failed} فشل</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={handleClose} disabled={running}>
            {result ? 'إغلاق' : 'إلغاء'}
          </Button>
          {!result && (
            <Button className="rounded-xl gap-1.5" disabled={running || products.length === 0} onClick={() => void handleRun()}>
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
              تنفيذ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryBulkRestockDialog;
