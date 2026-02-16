
import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";

interface SalesChartProps {
  orders: Array<{
    created_at: string;
    total_amount: number | string;
  }>;
  dateRange: string;
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

export const SalesChart = ({ orders, dateRange }: SalesChartProps) => {
  const chartData = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    
    const days = parseInt(dateRange) || 7;
    const grouped: { [key: string]: { revenue: number; orders: number } } = {};
    
    // Create date buckets
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' });
      grouped[key] = { revenue: 0, orders: 0 };
    }
    
    // Fill with data
    orders.forEach(order => {
      const date = new Date(order.created_at);
      const key = date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' });
      if (grouped[key]) {
        grouped[key].revenue += parseFloat(String(order.total_amount || 0));
        grouped[key].orders += 1;
      }
    });

    return Object.entries(grouped).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue),
      orders: data.orders,
    }));
  }, [orders, dateRange]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">حركة المبيعات</h2>
      </div>
      
      <Card className="border border-border shadow-sm rounded-2xl bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-foreground text-base">المبيعات خلال الفترة المحددة</CardTitle>
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
                  stroke="hsl(248, 53%, 58%)" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(248, 53%, 58%)" }}
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
