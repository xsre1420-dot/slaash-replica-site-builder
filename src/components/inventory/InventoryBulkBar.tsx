import { Download, PackagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InventoryBulkBarProps {
  selectedCount: number;
  onClear: () => void;
  onExportSelected: () => void;
  onBulkRestock: () => void;
  className?: string;
}

const InventoryBulkBar = ({
  selectedCount,
  onClear,
  onExportSelected,
  onBulkRestock,
  className,
}: InventoryBulkBarProps) => {
  if (selectedCount <= 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(100%,640px)] px-4',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-card/95 backdrop-blur-xl shadow-lg px-4 py-3">
        <Button type="button" variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={onClear}>
          <X className="w-4 h-4" />
        </Button>
        <p className="text-sm font-semibold text-foreground tabular-nums">
          {selectedCount} منتج محدد
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-xl h-9 gap-1.5" onClick={onExportSelected}>
            <Download className="w-3.5 h-3.5" />
            تصدير
          </Button>
          <Button type="button" size="sm" className="rounded-xl h-9 gap-1.5" onClick={onBulkRestock}>
            <PackagePlus className="w-3.5 h-3.5" />
            تعبئة
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InventoryBulkBar;
