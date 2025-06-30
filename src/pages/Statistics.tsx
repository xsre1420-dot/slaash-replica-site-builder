import { ArrowRight, Eye, ShoppingBag, Users, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { useEffect, useState } from "react";

const Statistics = () => {
  const [stats, setStats] = useState({
    totalVisitors: 0,
    totalOrders: 0,
    totalRevenue: 0,
    conversionRate: 0
  });

  const [dailyStats, setDailyStats] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    // جلب المعلومات الحقيقية من localStorage
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const products = JSON.parse(localStorage.getItem('products') || '[]');
    const visitorsString = localStorage.getItem('totalVisitors') || '0';
    const visitors = parseInt(visitorsString, 10) || 0;

    // حساب الإحصائيات
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const conversionRate = visitors > 0 ? ((totalOrders / visitors) * 100) : 0;

    setStats({
      totalVisitors: visitors,
      totalOrders,
      totalRevenue,
      conversionRate: parseFloat(conversionRate.toFixed(1))
    });

    // إنشاء بيانات الأيام السابقة
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate.toDateString() === date.toDateString();
      });
      
      last7Days.push({
        day: date.toLocaleDateString('ar-SA', { weekday: 'short' }),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
        visitors: Math.floor(Math.random() * 50) + 20 // محاكاة بيانات الزوار
      });
    }
    setDailyStats(last7Days);

    // أفضل المنتجات
    const productSales = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (productSales[item.product.name]) {
          productSales[item.product.name] += item.quantity;
        } else {
          productSales[item.product.name] = item.quantity;
        }
      });
    });

    const topProductsArray = Object.entries(productSales)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, sales]) => ({ name, sales }));

    setTopProducts(topProductsArray);

    // زيادة عداد الزوار
    const newVisitorCount = visitors + 1;
    localStorage.setItem('totalVisitors', newVisitorCount.toString());
  }, []);

  const chartConfig = {
    orders: {
      label: "الطلبات",
      color: "#6366f1",
    },
    revenue: {
      label: "الإيرادات",
      color: "#8b5cf6",
    },
    visitors: {
      label: "الزوار",
      color: "#06b6d4",
    }
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#3b82f6', '#d946ef'];

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Header */}
      <div className="text-white p-6" style={{ 
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
      }}>
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <Link to="/builder">
            <ArrowRight className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">الإحصائيات والتقارير</h1>
          <div className="w-6"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">إجمالي الزوار</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalVisitors.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                     style={{ 
                       background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                       boxShadow: '0 4px 15px rgba(6, 182, 212, 0.2)'
                     }}>
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">إجمالي الطلبات</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalOrders}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                     style={{ 
                       background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                       boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)'
                     }}>
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">إجمالي الإيرادات</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.totalRevenue.toLocaleString()} د.ع</p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                     style={{ 
                       background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
                       boxShadow: '0 4px 15px rgba(139, 92, 246, 0.2)'
                     }}>
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">معدل التحويل</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.conversionRate}%</p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                     style={{ 
                       background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                       boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)'
                     }}>
                  <Eye className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Orders Chart */}
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800">الطلبات اليومية</CardTitle>
              <CardDescription className="text-gray-600">آخر 7 أيام</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyStats}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Revenue Trend */}
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800">الإيرادات اليومية</CardTitle>
              <CardDescription className="text-gray-600">اتجاه الإيرادات</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyStats}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800">أفضل المنتجات</CardTitle>
              <CardDescription className="text-gray-600">الأكثر مبيعاً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.length > 0 ? (
                  topProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                             style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                          {index + 1}
                        </div>
                        <span className="font-semibold text-gray-800">{product.name}</span>
                      </div>
                      <span className="font-bold text-gray-600">{product.sales} مبيعة</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">لا توجد مبيعات حتى الآن</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Visitors vs Orders */}
          <Card className="border-0 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800">الزوار مقابل الطلبات</CardTitle>
              <CardDescription className="text-gray-600">آخر 7 أيام</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyStats}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="visitors" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', strokeWidth: 2, r: 3 }} />
                    <Line type="monotone" dataKey="orders" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', strokeWidth: 2, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
