
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { SalesStats } from "@/components/statistics/SalesStats";
import { CustomerStats } from "@/components/statistics/CustomerStats";
import { PerformanceStats } from "@/components/statistics/PerformanceStats";
import { TimeBasedStats } from "@/components/statistics/TimeBasedStats";
import { TopProductsSection } from "@/components/statistics/TopProductsSection";
import { DateRangeControls } from "@/components/statistics/DateRangeControls";
import { useRealStatistics } from "@/hooks/useRealStatistics";
import { AlertCircle, Loader2 } from "lucide-react";

const Statistics = () => {
  const [dateRange, setDateRange] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("visitors");

  const { stats, loading, error, refetch } = useRealStatistics(dateRange);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">جاري تحميل الإحصائيات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">خطأ في تحميل الإحصائيات</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={refetch}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد بيانات</h3>
          <p className="text-gray-500">لا توجد إحصائيات لعرضها حالياً</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">الإحصائيات والتقارير</h1>
            <Button 
              variant="outline" 
              className="rounded-2xl"
              onClick={refetch}
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              تحديث
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <DateRangeControls
          dateRange={dateRange}
          setDateRange={setDateRange}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
        />

        <SalesStats stats={stats} topProducts={stats.topProducts} />
        <CustomerStats stats={stats} />
        <PerformanceStats stats={stats} />
        <TimeBasedStats peakTimes={stats.peakTimes} />
        <TopProductsSection topProducts={stats.topProducts} />
      </div>
    </div>
  );
};

export default Statistics;
