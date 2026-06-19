import { CheckCircle, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OrdersBulkBarProps {
  selectedCount: number;
  totalVisible: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkComplete: () => void;
  onBulkCancel: () => void;
  processing?: boolean;
  className?: string;
}

const OrdersBulkBar = ({
  selectedCount,
  totalVisible,
  onSelectAll,
  onClearSelection,
  onBulkComplete,
  onBulkCancel,
  processing = false,
  className,
}: OrdersBulkBarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'sticky bottom-3 z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2',
        'rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-lg px-3 py-2.5 sm:px-4 sm:py-3',
        className
      )}
      dir="rtl"
    >
      <div className="flex items-center justify-between sm:justify-start gap-2">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {selectedCount} محدد
        </span>
        {selectedCount < totalVisible && (
          <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg" onClick={onSelectAll}>
            تحديد الكل ({totalVisible})
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="rounded-xl h-9 flex-1 sm:flex-none gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
          disabled={processing}
          onClick={onBulkComplete}
        >
          <CheckCircle className="h-4 w-4" />
          تأكيد المحدد
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-9 flex-1 sm:flex-none gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          disabled={processing}
          onClick={onBulkCancel}
        >
          <XCircle className="h-4 w-4" />
          إلغاء
        </Button>
      </div>
    </div>
  );
};

export default OrdersBulkBar;
