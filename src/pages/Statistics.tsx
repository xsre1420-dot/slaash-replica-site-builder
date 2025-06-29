
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from "recharts";

const Statistics = () => {
  const [dateFilter, setDateFilter] = useState("7"); // Last 7 days

  // Mock statistics data
  const visitorData = [
    { date: "اليوم", visitors: 45, orders: 12 },
    { date: "أمس", visitors: 38, orders: 8 },
    { date: "قبل يومين", visitors: 52, orders: 15 },
    { date: "قبل 3 أيام", visitors: 41, orders: 10 },
    { date: "قبل 4 أيام", visitors: 47, orders: 13 },
    { date: "قبل 5 أيام", visitors: 35, orders: 9 },
    { date: "قبل 6 أيام", visitors: 43, orders: 11 },
  ];

  const totalVisitors = visitorData.reduce((sum, day) => sum + day.visitors, 0);
  const totalOrders = visitorData.reduce((sum, day) => sum + day.orders, 0);

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Modern Header - White background */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl text-gray-700">
                <X className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">الإحصائيات</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Statistics Cards */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-right text-lg text-gray-800">إجمالي الزوار</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-800 mb-1">{totalVisitors}</div>
                  <div className="text-sm text-gray-600">خلال آخر {dateFilter} أيام</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-right text-lg text-gray-800">إجمالي الطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-800 mb-1">{totalOrders}</div>
                  <div className="text-sm text-gray-600">خلال آخر {dateFilter} أيام</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-3xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-right text-lg text-gray-800">فترة الإحصائيات</CardTitle>
              </CardHeader>
              <CardContent>
                <select 
                  value={dateFilter} 
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-xl text-right bg-white text-gray-800"
                >
                  <option value="7">آخر 7 أيام</option>
                  <option value="30">آخر 30 يوم</option>
                  <option value="90">آخر 3 شهور</option>
                </select>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-lg rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right text-gray-800">إحصائيات الزوار والطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    visitors: { label: "الزوار", color: "#3b82f6" },
                    orders: { label: "الطلبات", color: "#10b981" },
                  }}
                  className="h-[300px]"
                >
                  <BarChart data={visitorData}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="visitors" fill="#3b82f6" radius={8} />
                    <Bar dataKey="orders" fill="#10b981" radius={8} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right text-gray-800">اتجاه الطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    orders: { label: "الطلبات", color: "#f59e0b" },
                  }}
                  className="h-[200px]"
                >
                  <LineChart data={visitorData}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={3} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
