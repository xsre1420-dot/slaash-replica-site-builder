
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DateRangeControlsProps {
  dateRange: string;
  setDateRange: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  selectedMetric: string;
  setSelectedMetric: (value: string) => void;
}

const periodLabels: Record<string, string> = {
  "1": "اليوم",
  "7": "آخر 7 أيام",
  "30": "آخر 30 يوم",
  "90": "آخر 90 يوم",
  custom: "فترة مخصصة",
};

export const DateRangeControls = ({
  dateRange,
  setDateRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedMetric,
  setSelectedMetric,
}: DateRangeControlsProps) => {
  return (
    <div className="ds-card p-5 mb-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">الفترة الزمنية</h2>
          <p className="text-xs text-muted-foreground mt-0.5">يتم تحديث البيانات تلقائياً عند تغيير الفترة</p>
        </div>
        <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full w-fit">
          {periodLabels[dateRange] || 'فترة مخصصة'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="block text-foreground font-medium text-right text-sm">اختر الفترة</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="rounded-xl border-border/60">
              <SelectValue placeholder="اختر الفترة" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="1">اليوم</SelectItem>
              <SelectItem value="7">آخر 7 أيام</SelectItem>
              <SelectItem value="30">آخر 30 يوم</SelectItem>
              <SelectItem value="90">آخر 90 يوم</SelectItem>
              <SelectItem value="custom">فترة مخصصة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {dateRange === "custom" && (
          <>
            <div className="space-y-2">
              <Label className="block text-foreground font-medium text-right text-sm">من تاريخ</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label className="block text-foreground font-medium text-right text-sm">إلى تاريخ</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border-border/60"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label className="block text-foreground font-medium text-right text-sm">عرض الرسم البياني حسب</Label>
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="rounded-xl border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="visitors">الزوار</SelectItem>
              <SelectItem value="orders">الطلبات</SelectItem>
              <SelectItem value="revenue">الإيرادات</SelectItem>
              <SelectItem value="conversion">معدل التحويل</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export { periodLabels };
