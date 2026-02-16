
import { ShoppingCart, DollarSign, Package, TrendingUp, Eye } from "lucide-react";
import { StatCard } from "./StatCard";

interface SalesStatsProps {
  stats: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    revenueGrowth: number;
    ordersGrowth: number;
  };
  topProducts: Array<{ name: string }>;
}

export const SalesStats = ({ stats, topProducts }: SalesStatsProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <ShoppingCart className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">إحصائيات المبيعات</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المبيعات"
          value={`${stats.totalRevenue.toLocaleString()} د.ع`}
          growth={stats.revenueGrowth}
          icon={DollarSign}
          delay={0}
        />
        <StatCard
          title="إجمالي الطلبات"
          value={stats.totalOrders.toLocaleString()}
          growth={stats.ordersGrowth}
          icon={Package}
          delay={50}
        />
        <StatCard
          title="متوسط قيمة الطلب"
          value={`${stats.averageOrderValue.toLocaleString()} د.ع`}
          icon={TrendingUp}
          delay={100}
        />
        <StatCard
          title="أفضل المنتجات"
          value={topProducts.length > 0 ? topProducts[0].name : "لا توجد منتجات"}
          icon={Eye}
          delay={150}
        />
      </div>
    </div>
  );
};
