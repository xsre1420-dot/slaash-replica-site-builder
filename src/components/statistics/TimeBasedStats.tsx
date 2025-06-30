
import { Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface TimeBasedStatsProps {
  peakTimes: Array<{
    time: string;
    orders: number;
    percentage: number;
  }>;
}

export const TimeBasedStats = ({ peakTimes }: TimeBasedStatsProps) => {
  const chartConfig = {
    sales: {
      label: "المبيعات",
      color: "#6D63F2",
    },
  };

  const monthlyData = [
    { period: "يناير", sales: 180000 },
    { period: "فبراير", sales: 220000 },
    { period: "مارس", sales: 280000 },
    { period: "أبريل", sales: 320000 },
    { period: "مايو", sales: 380000 },
    { period: "يونيو", sales: 420000 },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
          <Clock className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">🕒 الإحصائيات الزمنية</h2>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Card className="border-0 shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-right">المبيعات اليومية/الأسبوعية/الشهرية</CardTitle>
            <CardDescription className="text-right">تطور المبيعات خلال الفترات الزمنية</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData}>
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
  );
};
