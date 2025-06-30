import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, TrendingUp, Package, ShoppingCart, DollarSign, Users, ArrowLeft, Eye, Download, RefreshCw, CreditCard, Truck, Clock, UserPlus, Repeat } from "lucide-react";
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
    productsGrowth: 4.2,
    newCustomers: 89,
    returningCustomers: 67,
    customerLifetimeValue: 87500,
    cartAbandonmentRate: 23.5,
    averageDeliveryTime: 35,
    cancelledOrdersRate: 4.2
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
            {growth !== undefined && (
              <div className={`flex items-center gap-1 mt-2 ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">{growth >= 0 ? '+' : ''}{growth}%</span>
              </div>
            )}
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
      color: "#6D63F2",
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
                background: 'linear-gradient(135deg, #6D63F2, #5B52E8)',
                boxShadow: '0 4px 15px rgba(109, 99, 242, 0.3)'
              }}
            >
              تطبيق
            </Button>
          </div>
        </div>

        {/* Sales Statistics Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">🛒 إحصائيات المبيعات</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="إجمالي المبيعات"
              value={`${stats.totalRevenue.toLocaleString()} د.ع`}
              growth={stats.revenueGrowth}
              icon={DollarSign}
              gradient="bg-gradient-to-br from-[#6D63F2] to-[#5B52E8]"
            />
            <StatCard
              title="إجمالي الطلبات"
              value={stats.totalOrders.toLocaleString()}
              growth={stats.ordersGrowth}
              icon={Package}
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
            <StatCard
              title="متوسط قيمة الطلب"
              value={`${stats.averageOrderValue.toLocaleString()} د.ع`}
              growth={5.2}
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              title="أفضل المنتجات"
              value={topProducts[0]?.name || "برجر لحم"}
              icon={Eye}
              gradient="bg-gradient-to-br from-green-500 to-green-600"
            />
          </div>
        </div>

        {/* Customer Statistics Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">👥 إحصائيات العملاء</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="عملاء جدد"
              value={stats.newCustomers.toLocaleString()}
              growth={18.5}
              icon={UserPlus}
              gradient="bg-gradient-to-br from-[#6D63F2] to-[#5B52E8]"
            />
            <StatCard
              title="عملاء عائدون"
              value={stats.returningCustomers.toLocaleString()}
              growth={12.3}
              icon={Repeat}
              gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />
            <StatCard
              title="قيمة العميل مدى الحياة"
              value={`${stats.customerLifetimeValue.toLocaleString()} د.ع`}
              growth={8.7}
              icon={DollarSign}
              gradient="bg-gradient-to-br from-green-500 to-green-600"
            />
          </div>
        </div>

        {/* Performance Statistics Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">📈 إحصائيات الأداء</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="معدل التحويل"
              value={`${stats.conversionRate}%`}
              growth={2.3}
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-[#6D63F2] to-[#5B52E8]"
            />
            <StatCard
              title="زوار المتجر"
              value={stats.totalVisitors.toLocaleString()}
              growth={stats.visitorsGrowth}
              icon={Eye}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatCard
              title="معدل هجر السلة"
              value={`${stats.cartAbandonmentRate}%`}
              growth={-5.2}
              icon={ShoppingCart}
              gradient="bg-gradient-to-br from-orange-500 to-orange-600"
            />
          </div>
        </div>

        {/* Payment & Shipping Statistics Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">💰 إحصائيات الدفع والشحن</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right">طرق الدفع الأكثر استخداماً</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethods}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {paymentMethods.map((item) => (
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

            <div className="grid grid-cols-1 gap-6">
              <StatCard
                title="متوسط وقت التوصيل"
                value={`${stats.averageDeliveryTime} دقيقة`}
                growth={-8.5}
                icon={Truck}
                gradient="bg-gradient-to-br from-[#6D63F2] to-[#5B52E8]"
              />
              <StatCard
                title="معدل الطلبات الملغية"
                value={`${stats.cancelledOrdersRate}%`}
                growth={-2.1}
                icon={Package}
                gradient="bg-gradient-to-br from-red-500 to-red-600"
              />
            </div>
          </div>
        </div>

        {/* Time-Based Statistics Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
              <Clock className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">🕒 الإحصائيات الزمنية</h2>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Daily Trends Chart */}
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right">المبيعات اليومية/الأسبوعية/الشهرية</CardTitle>
                <CardDescription className="text-right">تطور المبيعات خلال الفترات الزمنية</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={[
                      { period: "يناير", sales: 180000 },
                      { period: "فبراير", sales: 220000 },
                      { period: "مارس", sales: 280000 },
                      { period: "أبريل", sales: 320000 },
                      { period: "مايو", sales: 380000 },
                      { period: "يونيو", sales: 420000 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" stroke="#666" />
                      <YAxis stroke="#666" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#6D63F2"
                        fill="#6D63F2"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Peak Times */}
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right">أوقات الذروة</CardTitle>
                <CardDescription className="text-right">أكثر الأوقات نشاطاً في الطلبات</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {peakTimes.map((time, index) => (
                    <div key={time.time} className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'linear-gradient(to right, rgba(109, 99, 242, 0.1), rgba(109, 99, 242, 0.05))' }}>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{time.orders} طلب</span>
                          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#6D63F2', color: 'white' }}>
                            {time.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <h4 className="font-medium text-gray-800">{time.time}</h4>
                        <span className="text-sm" style={{ color: '#6D63F2' }}>المرتبة #{index + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top Products Section */}
        <Card className="border-0 shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-right">أفضل المنتجات مبيعاً</CardTitle>
            <CardDescription className="text-right">المنتجات الأكثر طلباً مع النسب المئوية</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'linear-gradient(to right, rgba(109, 99, 242, 0.1), rgba(109, 99, 242, 0.05))' }}>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{product.orders} طلب</span>
                      <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#6D63F2', color: 'white' }}>
                        {product.percentage}%
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-600">{product.revenue.toLocaleString()} د.ع</span>
                  </div>
                  <div className="text-right">
                    <h4 className="font-medium text-gray-800">{product.name}</h4>
                    <span className="text-sm" style={{ color: '#6D63F2' }}>المرتبة #{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
