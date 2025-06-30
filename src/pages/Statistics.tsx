
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, TrendingUp, Package, ShoppingCart, DollarSign, Users, ArrowLeft, Eye, Download, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

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
    productsGrowth: 4.2
  });

  const [dailyStats] = useState([
    { date: "2024-01-01", visitors: 85, orders: 12, revenue: 180000, conversion: 14.1 },
    { date: "2024-01-02", visitors: 92, orders: 15, revenue: 225000, conversion: 16.3 },
    { date: "2024-01-03", visitors: 78, orders: 8, revenue: 120000, conversion: 10.3 },
    { date: "2024-01-04", visitors: 110, orders: 20, revenue: 300000, conversion: 18.2 },
    { date: "2024-01-05", visitors: 95, orders: 18, revenue: 270000, conversion: 18.9 },
    { date: "2024-01-06", visitors: 125, orders: 22, revenue: 330000, conversion: 17.6 },
    { date: "2024-01-07", visitors: 138, orders: 25, revenue: 375000, conversion: 18.1 },
  ]);

  const [hourlyStats] = useState([
    { hour: "00:00", visitors: 12, orders: 2 },
    { hour: "01:00", visitors: 8, orders: 1 },
    { hour: "02:00", visitors: 5, orders: 0 },
    { hour: "03:00", visitors: 3, orders: 0 },
    { hour: "04:00", visitors: 2, orders: 0 },
    { hour: "05:00", visitors: 4, orders: 0 },
    { hour: "06:00", visitors: 15, orders: 3 },
    { hour: "07:00", visitors: 25, orders: 4 },
    { hour: "08:00", visitors: 35, orders: 6 },
    { hour: "09:00", visitors: 45, orders: 8 },
    { hour: "10:00", visitors: 55, orders: 12 },
    { hour: "11:00", visitors: 65, orders: 15 },
    { hour: "12:00", visitors: 85, orders: 20 },
    { hour: "13:00", visitors: 95, orders: 22 },
    { hour: "14:00", visitors: 88, orders: 18 },
    { hour: "15:00", visitors: 78, orders: 16 },
    { hour: "16:00", visitors: 68, orders: 14 },
    { hour: "17:00", visitors: 58, orders: 12 },
    { hour: "18:00", visitors: 48, orders: 10 },
    { hour: "19:00", visitors: 42, orders: 8 },
    { hour: "20:00", visitors: 38, orders: 6 },
    { hour: "21:00", visitors: 32, orders: 5 },
    { hour: "22:00", visitors: 25, orders: 3 },
    { hour: "23:00", visitors: 18, orders: 2 },
  ]);

  const [topProducts] = useState([
    { name: "برجر لحم", orders: 45, revenue: 675000, percentage: 28.8 },
    { name: "بيتزا مارجريتا", orders: 32, revenue: 480000, percentage: 20.5 },
    { name: "شاورما دجاج", orders: 28, revenue: 350000, percentage: 17.9 },
    { name: "سلطة قيصر", orders: 20, revenue: 200000, percentage: 12.8 },
    { name: "باستا ألفريدو", orders: 18, revenue: 270000, percentage: 11.5 },
    { name: "أخرى", orders: 13, revenue: 195000, percentage: 8.5 },
  ]);

  const [ordersByCategory] = useState([
    { name: "وجبات رئيسية", value: 45, color: "#3b82f6" },
    { name: "مقبلات", value: 25, color: "#8b5cf6" },
    { name: "مشروبات", value: 20, color: "#06b6d4" },
    { name: "حلويات", value: 10, color: "#10b981" },
  ]);

  const [deviceStats] = useState([
    { name: "الهاتف المحمول", value: 65, color: "#3b82f6" },
    { name: "الكمبيوتر", value: 25, color: "#8b5cf6" },
    { name: "الجهاز اللوحي", value: 10, color: "#06b6d4" },
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

  const StatCard = ({ title, value, growth, icon: Icon, gradient, suffix = "" }: any) => (
    <Card className="border-0 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}{suffix}</p>
            <div className={`flex items-center gap-1 mt-2 ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">{growth >= 0 ? '+' : ''}{growth}%</span>
            </div>
          </div>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${gradient}`}>
            <Icon className="w-8 h-8 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const chartConfig = {
    visitors: {
      label: "الزوار",
      color: "#3b82f6",
    },
    orders: {
      label: "الطلبات",
      color: "#8b5cf6",
    },
    revenue: {
      label: "الإيرادات",
      color: "#06b6d4",
    },
    conversion: {
      label: "معدل التحويل",
      color: "#10b981",
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/orders">
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
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
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
        {/* Date Range Controls */}
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
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}
            >
              تطبيق
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <StatCard
            title="زوار المتجر"
            value={stats.totalVisitors.toLocaleString()}
            growth={stats.visitorsGrowth}
            icon={Eye}
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            title="إجمالي الطلبات"
            value={stats.totalOrders.toLocaleString()}
            growth={stats.ordersGrowth}
            icon={ShoppingCart}
            gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard
            title="إجمالي الإيرادات"
            value={`${stats.totalRevenue.toLocaleString()}`}
            growth={stats.revenueGrowth}
            icon={DollarSign}
            gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
            suffix=" د.ع"
          />
          <StatCard
            title="عدد المنتجات"
            value={stats.totalProducts.toLocaleString()}
            growth={stats.productsGrowth}
            icon={Package}
            gradient="bg-gradient-to-br from-green-500 to-green-600"
          />
          <StatCard
            title="متوسط قيمة الطلب"
            value={`${stats.averageOrderValue.toLocaleString()}`}
            growth={5.2}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-orange-500 to-orange-600"
            suffix=" د.ع"
          />
          <StatCard
            title="معدل التحويل"
            value={`${stats.conversionRate}`}
            growth={2.3}
            icon={Users}
            gradient="bg-gradient-to-br from-pink-500 to-pink-600"
            suffix="%"
          />
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Daily Trends */}
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-right">الاتجاهات اليومية</CardTitle>
              <CardDescription className="text-right">تطور المقاييس خلال الأيام الماضية</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#666" />
                    <YAxis stroke="#666" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey={selectedMetric}
                      stroke={chartConfig[selectedMetric as keyof typeof chartConfig]?.color}
                      fill={chartConfig[selectedMetric as keyof typeof chartConfig]?.color}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Hourly Activity */}
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-right">النشاط حسب الساعة</CardTitle>
              <CardDescription className="text-right">توزيع الزوار والطلبات خلال اليوم</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={hourlyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" stroke="#666" />
                    <YAxis stroke="#666" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="visitors" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Products */}
          <Card className="lg:col-span-2 border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-right">أفضل المنتجات مبيعاً</CardTitle>
              <CardDescription className="text-right">المنتجات الأكثر طلباً مع النسب المئوية</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-blue-50 hover:from-blue-50 hover:to-blue-100 transition-all">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{product.orders} طلب</span>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                          {product.percentage}%
                        </span>
                      </div>
                      <span className="text-sm font-medium text-green-600">{product.revenue.toLocaleString()} د.ع</span>
                    </div>
                    <div className="text-right">
                      <h4 className="font-medium text-gray-800">{product.name}</h4>
                      <span className="text-sm text-blue-600">المرتبة #{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Charts Column */}
          <div className="space-y-6">
            {/* Orders by Category */}
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right">الطلبات حسب الفئة</CardTitle>
                <CardDescription className="text-right">توزيع الطلبات</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ordersByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {ordersByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {ordersByCategory.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.value}%</span>
                      <div className="flex items-center gap-2">
                        <span>{item.name}</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Device Stats */}
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right">الأجهزة المستخدمة</CardTitle>
                <CardDescription className="text-right">إحصائيات الأجهزة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deviceStats.map((device) => (
                    <div key={device.name} className="flex items-center justify-between">
                      <span className="font-medium">{device.value}%</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{device.name}</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: device.color }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
