
import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Download, AlertCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { SalesStats } from "@/components/statistics/SalesStats";
import { DateRangeControls } from "@/components/statistics/DateRangeControls";
import { useRealStatistics } from "@/hooks/useRealStatistics";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Suggestion #7: Lazy load heavy statistics tabs
const SalesChart = lazy(() => import("@/components/statistics/SalesChart").then(m => ({ default: m.SalesChart })));
const CustomerStats = lazy(() => import("@/components/statistics/CustomerStats").then(m => ({ default: m.CustomerStats })));
const PerformanceStats = lazy(() => import("@/components/statistics/PerformanceStats").then(m => ({ default: m.PerformanceStats })));
const TimeBasedStats = lazy(() => import("@/components/statistics/TimeBasedStats").then(m => ({ default: m.TimeBasedStats })));
const TopProductsSection = lazy(() => import("@/components/statistics/TopProductsSection").then(m => ({ default: m.TopProductsSection })));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const Statistics = () => {
  const [dateRange, setDateRange] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("visitors");
  const [activeTab, setActiveTab] = useState("overview");

  const { stats, rawOrders, loading, error, refetch } = useRealStatistics(dateRange);

  const exportCSV = useCallback(() => {
    if (!stats) return;
    const rows = [
      ["المؤشر", "القيمة"],
      ["إجمالي المبيعات", `${stats.totalRevenue} د.ع`],
      ["إجمالي الطلبات", String(stats.totalOrders)],
      ["متوسط قيمة الطلب", `${stats.averageOrderValue.toFixed(0)} د.ع`],
      ["زوار المتجر", String(stats.totalVisitors)],
      ["معدل التحويل", `${stats.conversionRate.toFixed(1)}%`],
      ["عملاء جدد", String(stats.newCustomers)],
      ["عملاء عائدون", String(stats.returningCustomers)],
      ["نمو المبيعات", `${stats.revenueGrowth.toFixed(1)}%`],
      ["نمو الطلبات", `${stats.ordersGrowth.toFixed(1)}%`],
    ];
    const csv = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statistics-${dateRange}days.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير التقرير بنجاح");
  }, [stats, dateRange]);

  // Suggestion #16: Smart loader with progress
  const summaryItems = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "المبيعات", value: `${stats.totalRevenue.toLocaleString()} د.ع`, growth: stats.revenueGrowth },
      { label: "الطلبات", value: String(stats.totalOrders), growth: stats.ordersGrowth },
      { label: "الزوار", value: String(stats.totalVisitors), growth: stats.visitorsGrowth },
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">جاري تحميل الإحصائيات...</p>
          <p className="text-xs text-muted-foreground/60 mt-1">يتم تحليل بيانات الطلبات والزوار</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">خطأ في تحميل الإحصائيات</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={refetch}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">لا توجد بيانات</h3>
          <p className="text-muted-foreground">لا توجد إحصائيات لعرضها حالياً</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-arabic">
      {/* Header */}
      <div className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" size="icon" className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-foreground">الإحصائيات والتقارير</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={exportCSV}>
                <Download className="w-4 h-4 ml-1" />
                تصدير
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={refetch}>
                <RefreshCw className="w-4 h-4 ml-1" />
                تحديث
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Quick Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in">
          {summaryItems.map((item) => (
            <div key={item.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-lg font-bold text-foreground">{item.value}</p>
              {item.growth !== 0 && (
                <p className={`text-xs font-medium mt-1 ${item.growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {item.growth >= 0 ? '↑' : '↓'} {Math.abs(item.growth).toFixed(1)}%
                </p>
              )}
            </div>
          ))}
        </div>

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

        {/* Suggestion #7: Tabbed lazy-loaded sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="overview">الرسم البياني</TabsTrigger>
            <TabsTrigger value="customers">العملاء</TabsTrigger>
            <TabsTrigger value="performance">الأداء</TabsTrigger>
            <TabsTrigger value="products">المنتجات</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <Suspense fallback={<TabLoader />}>
              <SalesChart orders={rawOrders} dateRange={dateRange} />
            </Suspense>
          </TabsContent>
          
          <TabsContent value="customers">
            <Suspense fallback={<TabLoader />}>
              <CustomerStats stats={stats} />
            </Suspense>
          </TabsContent>
          
          <TabsContent value="performance">
            <Suspense fallback={<TabLoader />}>
              <PerformanceStats stats={stats} />
              <TimeBasedStats peakTimes={stats.peakTimes} />
            </Suspense>
          </TabsContent>
          
          <TabsContent value="products">
            <Suspense fallback={<TabLoader />}>
              <TopProductsSection topProducts={stats.topProducts} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Statistics;
