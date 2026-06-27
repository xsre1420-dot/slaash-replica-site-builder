import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { OrderListFilters } from '@/utils/orderWorkflowUtils';
import { DELIVERY_STATUS_OPTIONS } from '@/utils/deliveryUtils';
import { PaymentStatus } from '@/utils/paymentUtils';
import { cn } from '@/lib/utils';

const PAYMENT_FILTER_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending_collection', label: 'بانتظار التحصيل' },
  { value: 'collected', label: 'تم التحصيل' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'partially_refunded', label: 'مسترد جزئياً' },
  { value: 'refunded', label: 'مسترد بالكامل' },
  { value: 'failed', label: 'فشل الدفع' },
  { value: 'disputed', label: 'نزاع' },
];

interface OrdersToolbarProps {
  filters: OrderListFilters;
  onChange: (patch: Partial<OrderListFilters>) => void;
  onClear: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

const OrdersToolbar = ({
  filters,
  onChange,
  onClear,
  showAdvanced,
  onToggleAdvanced,
}: OrdersToolbarProps) => {
  const hasActiveFilters =
    filters.search ||
    filters.orderStatus !== 'all' ||
    filters.paymentStatus !== 'all' ||
    filters.deliveryStatus !== 'all' ||
    filters.datePreset !== 'all' ||
    filters.minValue != null ||
    filters.maxValue != null;

  return (
    <Card className="border-border/50 shadow-sm min-w-0 overflow-hidden">
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
          <Input
            placeholder="بحث برقم الطلب، اسم العميل، أو الهاتف..."
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="pr-10 rounded-xl h-10 text-sm"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={filters.datePreset}
            onValueChange={(v) => onChange({ datePreset: v as OrderListFilters['datePreset'] })}
          >
            <SelectTrigger className="w-full sm:w-[140px] rounded-xl h-10 text-sm shrink-0">
              <SelectValue placeholder="التاريخ" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">كل التواريخ</SelectItem>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="yesterday">أمس</SelectItem>
              <SelectItem value="week">هذا الأسبوع</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2 flex-1">
            <Button
              variant={showAdvanced ? 'default' : 'outline'}
              className={cn(
                'rounded-xl gap-2 flex-1 sm:flex-none h-10',
                !showAdvanced && 'border-border/60 bg-card'
              )}
              onClick={onToggleAdvanced}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-sm">فلاتر</span>
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                className="rounded-xl gap-1 text-muted-foreground h-10 px-3 shrink-0"
                onClick={onClear}
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">مسح</span>
              </Button>
            )}
          </div>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-border/50">
            <Select
              value={filters.orderStatus}
              onValueChange={(v) => onChange({ orderStatus: v as OrderListFilters['orderStatus'] })}
            >
              <SelectTrigger className="rounded-xl h-10 text-sm">
                <SelectValue placeholder="حالة الطلب" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل حالات الطلب</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.paymentStatus} onValueChange={(v) => onChange({ paymentStatus: v })}>
              <SelectTrigger className="rounded-xl h-10 text-sm">
                <SelectValue placeholder="حالة الدفع" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل حالات الدفع</SelectItem>
                {PAYMENT_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.deliveryStatus} onValueChange={(v) => onChange({ deliveryStatus: v })}>
              <SelectTrigger className="rounded-xl h-10 text-sm">
                <SelectValue placeholder="حالة الشحن" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل حالات الشحن</SelectItem>
                {DELIVERY_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={0}
              placeholder="الحد الأدنى (د.ع)"
              value={filters.minValue ?? ''}
              onChange={(e) => onChange({ minValue: e.target.value ? Number(e.target.value) : undefined })}
              className="rounded-xl h-10 text-sm"
            />
            <Input
              type="number"
              min={0}
              placeholder="الحد الأقصى (د.ع)"
              value={filters.maxValue ?? ''}
              onChange={(e) => onChange({ maxValue: e.target.value ? Number(e.target.value) : undefined })}
              className="rounded-xl h-10 text-sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';
export default OrdersToolbar;
