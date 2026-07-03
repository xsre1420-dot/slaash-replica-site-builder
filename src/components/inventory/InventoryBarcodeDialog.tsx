import { useState } from 'react';
import { ScanLine, Search } from 'lucide-react';
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
import { lookupProductByBarcode } from '@/services/inventoryService';
import type { InventoryProductRow } from '@/utils/inventoryPageUtils';

interface InventoryBarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  onProductFound: (product: InventoryProductRow) => void;
  products: InventoryProductRow[];
}

const InventoryBarcodeDialog = ({
  open,
  onOpenChange,
  ownerId,
  onProductFound,
  products,
}: InventoryBarcodeDialogProps) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const found = await lookupProductByBarcode(ownerId, trimmed);
      if (found) {
        const row = products.find((p) => p.id === found.id);
        if (row) {
          onProductFound(row);
          onOpenChange(false);
          setCode('');
          return;
        }
      }
      const local = products.find(
        (p) => p.sku?.toLowerCase() === trimmed.toLowerCase() || (p as InventoryProductRow & { barcode?: string }).barcode?.toLowerCase() === trimmed.toLowerCase()
      );
      if (local) {
        onProductFound(local);
        onOpenChange(false);
        setCode('');
        return;
      }
      setError('لم يُعثر على منتج بهذا الرمز');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl text-right sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end">
            <ScanLine className="w-5 h-5 text-primary" />
            مسح / بحث باركود
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <Label className="block">SKU أو باركود</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            className="rounded-xl font-mono text-left dir-ltr"
            placeholder="امسح أو اكتب الرمز"
            autoFocus
          />
          {error && <p className="text-xs text-destructive text-right">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button className="rounded-xl gap-1.5" disabled={loading} onClick={() => void search()}>
            <Search className="w-4 h-4" />
            بحث
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryBarcodeDialog;
