
import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, AlertCircle, TrendingUp, Users, BarChart3, Package, Copy, Plus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesStats } from "@/components/statistics/SalesStats";
import { DateRangeControls, periodLabels } from "@/components/statistics/DateRangeControls";
import { useRealStatistics } from "@/hooks/useRealStatistics";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SalesChart = lazy(() => import("@/components/statistics/SalesChart").then(m => ({ default: m.SalesChart })));
const CustomerStats = lazy(() => import("@/components/statistics/CustomerStats").then(m => ({ default: m.CustomerStats })));
const PerformanceStats = lazy(() => import("@/components/statistics/PerformanceStats").then(m => ({ default: m.PerformanceStats })));
const TimeBasedStats = lazy(() => import("@/components/statistics/TimeBasedStats").then(m => ({ default: m.TimeBasedStats })));
const TopProductsSection = lazy(() => import("@/components/statistics/TopProductsSection").then(m => ({ default: m.TopProductsSection })));

const TabLoader = () => (
  <div className="space-y-4 py-4">
    <Skeleton className="h-48 rounded-2xl" />
    <Skeleton className="h-32 rounded-2xl" />
  </div>
);

const StatisticsLoading = () => (
  <DashboardLayout>
    <PageHeader
      title="الإحصائيات والتقارير"
      description="جاري تحميل بيانات متجرك..."
      hideBack
      breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'الإحصائيات' }]}
    />
    <div className="ds-page space-y-6">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  </DashboardLayout>
);

const Statistics = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("revenue");
  const [activeTab, setActiveTab] = useState("overview");

  const { stats, rawOrders, loading, error, refetch } = useRealStatistics(
    dateRange,
    startDate,
    endDate
  );

  const exportCSV = useCallback(() => {
    if (!stats) return;
    const rows = [
      ["المؤشر", "القيمة"],
      ["الفترة", periodLabels[dateRange] || dateRange],
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

  const handleCopyStoreLink = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/store/${user.username}`);
      toast.success("تم نسخ رابط المتجر");
    } catch {
      toast.error("فشل في نسخ الرابط");
    }
  };

  const hasActivity = stats && (stats.totalOrders > 0 || stats.totalVisitors > 0);

  const insightMessage = useMemo(() => {
    if (!stats) return null;
    if (stats.totalOrders === 0 && stats.totalVisitors === 0) {
      return {
        type: 'empty' as const,
        title: 'لا توجد بيانات بعد',
        description: 'شارك رابط متجرك أو أضف منتجات لبدء تتبع المبيعات والزوار.',
      };
    }
    if (stats.totalVisitors > 0 && stats.totalOrders === 0) {
      return {
        type: 'warning' as const,
        title: 'زوار بدون طلبات',
        description: `لديك ${stats.totalVisitors} زائر${stats.totalVisitors === 1 ? '' : 'اً'} بدون أي طلب. تحقق من أسعار المنتجات وطرق الدفع.`,
      };
    }
    if (stats.revenueGrowth < 0) {
      return {
        type: 'warning' as const,
        title: 'انخفاض في المبيعات',
        description: `المبيعات انخفضت ${Math.abs(stats.revenueGrowth).toFixed(1)}% مقارنة بالفترة السابقة.`,
      };
    }
    if (stats.revenueGrowth > 0) {
      return {
        type: 'success' as const,
        title: 'أداء جيد',
        description: `المبيعات ارتفعت ${stats.revenueGrowth.toFixed(1)}% — استمر في التسويق!`,
      };
    }
    return null;
  }, [stats]);

  if (loading) return <StatisticsLoading />;

  if (error) {
    return (
      <DashboardLayout>
        <PageHeader title="الإحصائيات والتقارير" hideBack breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'الإحصائيات' }]} />
        <div className="ds-page flex items-center justify-center py-16">
          <div className="text-center max-w-md">
            <AlertCircle className="w-14 h-14 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">تعذّر تحميل الإحصائيات</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{error}</p>
            <Button onClick={refetch} className="rounded-xl min-h-[44px]">
              <RefreshCw className="w-4 h-4 ml-1" />
              إعادة المحاولة
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!stats) return null;

  return (
    <DashboardLayout>
      <PageHeader
        title="الإحصائيات والتقارير"
        description={`تحليل أداء متجرك — ${periodLabels[dateRange] || 'الفترة المحددة'}`}
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'الإحصائيات' }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl min-h-[44px]" onClick={exportCSV} disabled={!hasActivity}>
              <Download className="w-4 h-4 ml-1" />
              <span className="hidden sm:inline">تصدير</span>
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl min-h-[44px]" onClick={refetch}>
              <RefreshCw className="w-4 h-4 ml-1" />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
          </>
        }
      />

      <div className="ds-page">
        {/* 1. Date controls first — user picks context before reading numbers */}
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

        {/* 2. Smart insight — tells user what the numbers mean */}
        {insightMessage && (
          <div
            className={`rounded-xl border p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3 ${
              insightMessage.type === 'empty'
                ? 'border-border/60 bg-muted/30'
                : insightMessage.type === 'warning'
                  ? 'border-warning/20 bg-warning/5'
                  : 'border-success/20 bg-success/5'
            }`}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{insightMessage.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insightMessage.description}</p>
            </div>
            {insightMessage.type === 'empty' && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={handleCopyStoreLink}>
                  <Copy className="w-3.5 h-3.5 ml-1" />
                  نسخ الرابط
                </Button>
                <Link to="/add-product">
                  <Button size="sm" className="rounded-xl">
                    <Plus className="w-3.5 h-3.5 ml-1" />
                    إضافة منتج
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 3. Primary KPIs */}
        <SalesStats stats={stats} topProducts={stats.topProducts} />

        {/* 4. Detailed breakdown tabs */}
        <div>
          <h3 className="ds-section-title mb-3 px-1">تفاصيل إضافية</h3>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full overflow-x-auto scrollbar-hide rounded-xl p-1 h-auto gap-1 mb-4">
              <TabsTrigger value="overview" className="gap-1.5 shrink-0">
                <BarChart3 className="w-4 h-4" />
                الرسم البياني
              </TabsTrigger>
              <TabsTrigger value="customers" className="gap-1.5 shrink-0">
                <Users className="w-4 h-4" />
                العملاء
              </TabsTrigger>
              <TabsTrigger value="performance" className="gap-1.5 shrink-0">
                <TrendingUp className="w-4 h-4" />
                الأداء
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5 shrink-0">
                <Package className="w-4 h-4" />
                المنتجات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Suspense fallback={<TabLoader />}>
                <SalesChart orders={rawOrders} dateRange={dateRange} metric={selectedMetric} />
              </Suspense>
            </TabsContent>

            <TabsContent value="customers">
              <Suspense fallback={<TabLoader />}>
                <CustomerStats stats={stats} />
              </Suspense>
            </TabsContent>

            <TabsContent value="performance">
              <Suspense fallback={<TabLoader />}>
                <div className="space-y-6">
                  <PerformanceStats stats={stats} />
                  <TimeBasedStats peakTimes={stats.peakTimes} />
                </div>
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
    </DashboardLayout>
  );
};

export default Statistics;
