
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, TrendingUp, Package, ShoppingCart, DollarSign, Users, ArrowLeft, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const Statistics = () => {
  const [dateRange, setDateRange] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stats, setStats] = useState({
    totalVisitors: 1250,
    totalOrders: 156,
    totalRevenue: 2450000,
    totalProducts: 24,
    visitorsGrowth: 15.2,
    ordersGrowth: 12.5,
    revenueGrowth: 8.3,
    productsGrowth: 4.2
  });

  const [dailyStats] = useState([
    { date: "2024-01-01", visitors: 85, orders: 12, revenue: 180000 },
    { date: "2024-01-02", visitors: 92, orders: 15, revenue: 225000 },
    { date: "2024-01-03", visitors: 78, orders: 8, revenue: 120000 },
    { date: "2024-01-04", visitors: 110, orders: 20, revenue: 300000 },
    { date: "2024-01-05", visitors: 95, orders: 18, revenue: 270000 },
    { date: "2024-01-06", visitors: 125, orders: 22, revenue: 330000 },
    { date: "2024-01-07", visitors: 138, orders: 25, revenue: 375000 },
  ]);

  const [topProducts] = useState([
    { name: "برجر لحم", orders: 45, revenue: 675000 },
    { name: "بيتزا مارجريتا", orders: 32, revenue: 480000 },
    { name: "شاورما دجاج", orders: 28, revenue: 350000 },
    { name: "سلطة قيصر", orders: 20, revenue: 200000 },
    { name: "باستا ألفريدو", orders: 18, revenue: 270000 },
  ]);

  const [ordersByCategory] = useState([
    { name: "وجبات رئيسية", value: 45, color: "#6366f1" },
    { name: "مقبلات", value: 25, color: "#8b5cf6" },
    { name: "مشروبات", value: 20, color: "#3b82f6" },
    { name: "حلويات", value: 10, color: "#06b6d4" },
  ]);

  useEffect(() => {
    const range = parseInt(dateRange);
    if (range === 30) {
      setStats(prev => ({
        ...prev,
        totalVisitors: 3200,
        totalOrders: 580,
        totalRevenue: 8750000,
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
        visitorsGrowth: 28.5,
        ordersGrowth: 22.1,
        revenueGrowth: 19.5
      }));
    }
  }, [dateRange]);

  const StatCard = ({ title, value, growth, icon: Icon, gradient }: any) => (
    <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
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
      color: "#6366f1",
    },
    orders: {
      label: "الطلبات",
      color: "#8b5cf6",
    },
    revenue: {
      label: "الإيرادات",
      color: "#3b82f6",
    },
  };

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
            <div className="w-10"></div>
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

            <Button 
              className="rounded-2xl px-8 text-white shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
              }}
            >
              تطبيق
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
            gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
          />
          <StatCard
            title="إجمالي الإيرادات"
            value={`${stats.totalRevenue.toLocaleString()} د.ع`}
            growth={stats.revenueGrowth}
            icon={DollarSign}
            gradient="bg-gradient-to-br from-purple-500 to-pink-500"
          />
          <StatCard
            title="عدد المنتجات"
            value={stats.totalProducts.toLocaleString()}
            growth={stats.productsGrowth}
            icon={Package}
            gradient="bg-gradient-to-br from-cyan-500 to-blue-500"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Visitors Chart */}
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-right">زوار المتجر اليومي</CardTitle>
              <CardDescription className="text-right">عدد الزوار خلال الأيام الماضية</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#666" />
                    <YAxis stroke="#666" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Orders Chart */}
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-right">الطلبات اليومية</CardTitle>
              <CardDescription className="text-right">عدد الطلبات خلال الأيام الماضية</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#666" />
                    <YAxis stroke="#666" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="orders"
                      fill="#8b5cf6"
                      radius={[8, 8, 0, 0]}
                    />
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
              <CardDescription className="text-right">المنتجات الأكثر طلباً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-4 rounded-2xl"
                       style={{ background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)' }}>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">{product.orders} طلب</span>
                      <br />
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

          {/* Orders by Category */}
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-right">الطلبات حسب الفئة</CardTitle>
              <CardDescription className="text-right">توزيع الطلبات</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ordersByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
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
        </div>
      </div>
    </div>
  );
};

export default Statistics;
