import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { OrderListFilters } from '@/utils/orderWorkflowUtils';
import { cn } from '@/lib/utils';

const DATE_CHIPS: { value: OrderListFilters['datePreset']; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'الأسبوع' },
  { value: 'month', label: 'الشهر' },
];

interface OrdersToolbarProps {
  filters: OrderListFilters;
  onChange: (patch: Partial<OrderListFilters>) => void;
  onClear: () => void;
}

const OrdersToolbar = ({ filters, onChange, onClear }: OrdersToolbarProps) => {
  const hasActiveFilters = filters.search || filters.datePreset !== 'all';

  return (
    <div className="space-y-2.5 min-w-0" dir="rtl">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
        <Input
          placeholder="بحث بالطلب، الاسم، أو الهاتف..."
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="pr-10 pl-9 rounded-xl h-11 text-sm bg-muted/30 border-border/50 focus-visible:bg-background w-full"
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onChange({ search: '' })}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            aria-label="مسح البحث"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {DATE_CHIPS.map((chip) => {
          const active = filters.datePreset === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onChange({ datePreset: chip.value })}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {chip.label}
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive whitespace-nowrap shrink-0 hover:bg-destructive/10"
          >
            مسح الكل
          </button>
        )}
      </div>
    </div>
  );
};

export { DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';
export default OrdersToolbar;
