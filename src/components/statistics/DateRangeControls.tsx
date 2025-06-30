
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
    <div className="bg-white rounded-3xl shadow-sm p-6 mb-8">
      <div className="flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1">
          <Label className="block text-gray-700 font-medium mb-2 text-right">الفترة الزمنية</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="rounded-2xl border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
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
              <Label className="block text-gray-700 font-medium mb-2 text-right">من تاريخ</Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-2xl border-gray-200"
              />
            </div>
            <div className="flex-1">
              <Label className="block text-gray-700 font-medium mb-2 text-right">إلى تاريخ</Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-2xl border-gray-200"
              />
            </div>
          </>
        )}

        <div className="flex-1">
          <Label className="block text-gray-700 font-medium mb-2 text-right">المقياس</Label>
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="rounded-2xl border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="visitors">الزوار</SelectItem>
              <SelectItem value="orders">الطلبات</SelectItem>
              <SelectItem value="revenue">الإيرادات</SelectItem>
              <SelectItem value="conversion">معدل التحويل</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          className="rounded-2xl px-8 text-white shadow-lg"
          style={{ 
            background: 'linear-gradient(135deg, #6D63F2, #5B52E8)',
            boxShadow: '0 4px 15px rgba(109, 99, 242, 0.3)'
          }}
        >
          تطبيق
        </Button>
      </div>
    </div>
  );
};
