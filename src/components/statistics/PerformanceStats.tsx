
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
  );
};
