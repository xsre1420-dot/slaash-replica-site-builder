
import { TrendingUp, Eye, ShoppingCart } from "lucide-react";
import { StatCard } from "./StatCard";

interface PerformanceStatsProps {
  stats: {
    conversionRate: number;
    totalVisitors: number;
    cartAbandonmentRate: number;
    visitorsGrowth: number;
  };
}

export const PerformanceStats = ({ stats }: PerformanceStatsProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">إحصائيات الأداء</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="معدل التحويل"
          value={`${stats.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          delay={0}
        />
        <StatCard
          title="زوار المتجر"
          value={stats.totalVisitors.toLocaleString()}
          growth={stats.visitorsGrowth}
          icon={Eye}
          delay={50}
        />
        <StatCard
          title="معدل هجر السلة"
          value={`${stats.cartAbandonmentRate.toFixed(1)}%`}
          icon={ShoppingCart}
          delay={100}
        />
      </div>
    </div>
  );
};
