
import { CreditCard, Truck, Package } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { StatCard } from "./StatCard";

interface PaymentStatsProps {
  stats: {
    averageDeliveryTime: number;
    cancelledOrdersRate: number;
  };
  paymentMethods: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border rounded shadow">
        <p className="text-sm font-medium">{payload[0].payload.name}</p>
        <p className="text-sm text-gray-600">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export const PaymentStats = ({ stats, paymentMethods }: PaymentStatsProps) => {
  return (
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
                  <Tooltip content={<CustomTooltip />} />
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
  );
};
