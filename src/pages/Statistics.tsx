
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { SalesStats } from "@/components/statistics/SalesStats";
import { CustomerStats } from "@/components/statistics/CustomerStats";
import { PerformanceStats } from "@/components/statistics/PerformanceStats";
import { PaymentStats } from "@/components/statistics/PaymentStats";
import { TimeBasedStats } from "@/components/statistics/TimeBasedStats";
import { TopProductsSection } from "@/components/statistics/TopProductsSection";
import { DateRangeControls } from "@/components/statistics/DateRangeControls";

const Statistics = () => {
  const [dateRange, setDateRange] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("visitors");

  const [stats, setStats] = useState({
    totalVisitors: 1250,
    totalOrders: 156,
    totalRevenue: 2450000,
    totalProducts: 24,
    averageOrderValue: 15705,
    conversionRate: 12.5,
    visitorsGrowth: 15.2,
    ordersGrowth: 12.5,
    revenueGrowth: 8.3,
    productsGrowth: 4.2,
    newCustomers: 89,
    returningCustomers: 67,
    customerLifetimeValue: 87500,
    cartAbandonmentRate: 23.5,
    averageDeliveryTime: 35,
    cancelledOrdersRate: 4.2
  });

  const [topProducts] = useState([
    { name: "برجر لحم", orders: 45, revenue: 675000, percentage: 28.8 },
    { name: "بيتزا مارجريتا", orders: 32, revenue: 480000, percentage: 20.5 },
    { name: "شاورما دجاج", orders: 28, revenue: 350000, percentage: 17.9 },
    { name: "سلطة قيصر", orders: 20, revenue: 200000, percentage: 12.8 },
    { name: "باستا ألفريدو", orders: 18, revenue: 270000, percentage: 11.5 },
    { name: "أخرى", orders: 13, revenue: 195000, percentage: 8.5 },
  ]);

  const [paymentMethods] = useState([
    { name: "الدفع عند الاستلام", value: 65, color: "#6D63F2" },
    { name: "بطاقة ائتمان", value: 25, color: "#8B5CF6" },
    { name: "محفظة رقمية", value: 10, color: "#A855F7" },
  ]);

  const [peakTimes] = useState([
    { time: "12:00 - 14:00", orders: 45, percentage: 28.8 },
    { time: "19:00 - 21:00", orders: 38, percentage: 24.4 },
    { time: "18:00 - 19:00", orders: 25, percentage: 16.0 },
    { time: "14:00 - 16:00", orders: 18, percentage: 11.5 },
    { time: "21:00 - 23:00", orders: 15, percentage: 9.6 },
  ]);

  useEffect(() => {
    const range = parseInt(dateRange);
    if (range === 30) {
      setStats(prev => ({
        ...prev,
        totalVisitors: 3200,
        totalOrders: 580,
        totalRevenue: 8750000,
        averageOrderValue: 15086,
        conversionRate: 18.1,
        visitorsGrowth: 22.1,
        ordersGrowth: 18.2,
        revenueGrowth: 15.8
      }));
    } else if (range === 90) {
      setStats(prev => ({
        ...prev,
        totalVisitors: 9500,
        totalOrders: 1680,
        totalRevenue: 25200000,
        averageOrderValue: 15000,
        conversionRate: 17.7,
        visitorsGrowth: 28.5,
        ordersGrowth: 22.1,
        revenueGrowth: 19.5
      }));
    }
  }, [dateRange]);

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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="rounded-2xl"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                تحديث
              </Button>
              <Button 
                className="rounded-2xl text-white"
                style={{ 
                  background: 'linear-gradient(135deg, #6D63F2, #5B52E8)',
                  boxShadow: '0 4px 15px rgba(109, 99, 242, 0.3)'
                }}
              >
                <Download className="w-4 h-4 ml-2" />
                تصدير
              </Button>
            </div>
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

        <SalesStats stats={stats} topProducts={topProducts} />
        <CustomerStats stats={stats} />
        <PerformanceStats stats={stats} />
        <PaymentStats stats={stats} paymentMethods={paymentMethods} />
        <TimeBasedStats peakTimes={peakTimes} />
        <TopProductsSection topProducts={topProducts} />
      </div>
    </div>
  );
};

export default Statistics;
