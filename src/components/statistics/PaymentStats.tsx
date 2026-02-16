
import { CreditCard } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface PaymentStatsProps {
  paymentMethods: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

const COLORS = ["hsl(248, 53%, 58%)", "hsl(248, 53%, 68%)", "hsl(220, 9%, 46%)"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card p-2 border border-border rounded-lg shadow-sm">
        <p className="text-sm font-medium text-foreground">{payload[0].payload.name}</p>
        <p className="text-sm text-muted-foreground">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export const PaymentStats = ({ paymentMethods }: PaymentStatsProps) => {
  return (
    <div className="mb-8 animate-fade-in" style={{ animationDelay: '150ms' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">إحصائيات الدفع</h2>
      </div>
      
      <Card className="border border-border shadow-sm rounded-2xl bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-right text-foreground text-base">طرق الدفع الأكثر استخداماً</CardTitle>
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
                  {paymentMethods.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {paymentMethods.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{item.value}%</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{item.name}</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
