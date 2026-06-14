import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { OrderListFilters, DEFAULT_ORDER_FILTERS } from '@/utils/orderWorkflowUtils';
import { DELIVERY_STATUS_OPTIONS } from '@/utils/deliveryUtils';
import { PaymentStatus } from '@/utils/paymentUtils';

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
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="بحث برقم الطلب، اسم العميل، أو الهاتف..."
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              className="pr-10 rounded-xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filters.datePreset} onValueChange={(v) => onChange({ datePreset: v as OrderListFilters['datePreset'] })}>
              <SelectTrigger className="w-[140px] rounded-xl">
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
            <Button variant="outline" className="rounded-xl gap-2" onClick={onToggleAdvanced}>
              <SlidersHorizontal className="w-4 h-4" />
              فلاتر متقدمة
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" className="rounded-xl gap-1 text-muted-foreground" onClick={onClear}>
                <X className="w-4 h-4" />
                مسح
              </Button>
            )}
          </div>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-border/50">
            <Select value={filters.orderStatus} onValueChange={(v) => onChange({ orderStatus: v as OrderListFilters['orderStatus'] })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="حالة الطلب" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل حالات الطلب</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.paymentStatus} onValueChange={(v) => onChange({ paymentStatus: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="حالة الدفع" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل حالات الدفع</SelectItem>
                {PAYMENT_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.deliveryStatus} onValueChange={(v) => onChange({ deliveryStatus: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="حالة الشحن" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل حالات الشحن</SelectItem>
                {DELIVERY_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={0}
              placeholder="الحد الأدنى (د.ع)"
              value={filters.minValue ?? ''}
              onChange={(e) => onChange({ minValue: e.target.value ? Number(e.target.value) : undefined })}
              className="rounded-xl"
            />
            <Input
              type="number"
              min={0}
              placeholder="الحد الأقصى (د.ع)"
              value={filters.maxValue ?? ''}
              onChange={(e) => onChange({ maxValue: e.target.value ? Number(e.target.value) : undefined })}
              className="rounded-xl"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { DEFAULT_ORDER_FILTERS };
export default OrdersToolbar;
