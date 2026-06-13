
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, ShoppingBag } from "lucide-react";

interface SalesChartProps {
  orders: Array<{
    created_at: string;
    total_amount: number | string;
    status?: string;
  }>;
  chartStart: Date;
  chartEnd: Date;
  metric?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card p-3 border border-border rounded-lg shadow-sm">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-primary">{Number(payload[0].value).toLocaleString()} د.ع</p>
        <p className="text-xs text-muted-foreground">{payload[1]?.value || 0} طلب</p>
      </div>
    );
  }
  return null;
};

const dayKey = (date: Date) =>
  date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' });

export const SalesChart = ({ orders, chartStart, chartEnd }: SalesChartProps) => {
  const chartData = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    const grouped: { [key: string]: { revenue: number; orders: number; sortKey: number } } = {};
    const cursor = new Date(chartStart);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(chartEnd);
    end.setHours(23, 59, 59, 999);

    while (cursor <= end) {
      const key = dayKey(cursor);
      grouped[key] = { revenue: 0, orders: 0, sortKey: cursor.getTime() };
      cursor.setDate(cursor.getDate() + 1);
    }

    orders.forEach(order => {
      if (order.status === 'cancelled') return;
      const date = new Date(order.created_at);
      const key = dayKey(date);
      if (grouped[key]) {
        grouped[key].revenue += parseFloat(String(order.total_amount || 0));
        grouped[key].orders += 1;
      }
    });

    return Object.entries(grouped)
      .sort(([, a], [, b]) => a.sortKey - b.sortKey)
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue),
        orders: data.orders,
      }));
  }, [orders, chartStart, chartEnd]);

  if (chartData.every(d => d.revenue === 0 && d.orders === 0)) {
    return (
      <div className="ds-card p-8 text-center mb-8">
        <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">لا توجد مبيعات في هذه الفترة</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto leading-relaxed">
          عندما تبدأ بالبيع، سيظهر الرسم البياني هنا تلقائياً.
        </p>
        <Link to="/orders">
          <Button variant="outline" size="sm" className="rounded-xl">عرض الطلبات</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">حركة المبيعات</h2>
          <p className="text-xs text-muted-foreground">الخط المتصل: الإيرادات · المتقطع: عدد الطلبات</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-foreground text-base">المبيعات اليومية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(220, 9%, 46%)"
                  reversed
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(220, 9%, 46%)"
                  orientation="right"
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(239, 84%, 67%)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(239, 84%, 67%)" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(220, 9%, 46%)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
