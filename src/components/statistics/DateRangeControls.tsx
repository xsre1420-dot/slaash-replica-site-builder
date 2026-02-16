
import { Button } from "@/components/ui/button";
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

export const DateRangeControls = ({
  dateRange,
  setDateRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedMetric,
  setSelectedMetric
}: DateRangeControlsProps) => {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mb-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <Label className="block text-foreground font-medium mb-2 text-right text-sm">الفترة الزمنية</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="rounded-xl border-border">
              <SelectValue />
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
            <div className="flex-1">
              <Label className="block text-foreground font-medium mb-2 text-right text-sm">من تاريخ</Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border-border"
              />
            </div>
            <div className="flex-1">
              <Label className="block text-foreground font-medium mb-2 text-right text-sm">إلى تاريخ</Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border-border"
              />
            </div>
          </>
        )}

        <div className="flex-1">
          <Label className="block text-foreground font-medium mb-2 text-right text-sm">المقياس</Label>
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="rounded-xl border-border">
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

        <Button className="rounded-xl px-6 bg-primary text-primary-foreground hover:bg-primary/90">
          تطبيق
        </Button>
      </div>
    </div>
  );
};
