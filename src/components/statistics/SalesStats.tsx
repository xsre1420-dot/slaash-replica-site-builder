
import { ShoppingCart, DollarSign, Package, TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";

interface SalesStatsProps {
  stats: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    revenueGrowth: number;
    ordersGrowth: number;
    conversionRate: number;
    totalVisitors: number;
  };
  topProducts: Array<{ name: string }>;
}

export const SalesStats = ({ stats, topProducts }: SalesStatsProps) => {
  return (
    <div className="mb-8">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">المؤشرات الرئيسية</h2>
        <p className="text-xs text-muted-foreground mt-0.5">أهم أرقام متجرك — ابدأ من هنا</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المبيعات"
          value={`${stats.totalRevenue.toLocaleString()} د.ع`}
          growth={stats.revenueGrowth}
          icon={DollarSign}
          delay={0}
        />
        <StatCard
          title="عدد الطلبات"
          value={stats.totalOrders.toLocaleString()}
          growth={stats.ordersGrowth}
          icon={Package}
          delay={50}
        />
        <StatCard
          title="متوسط قيمة الطلب"
          value={stats.totalOrders > 0 ? `${stats.averageOrderValue.toLocaleString()} د.ع` : '—'}
          icon={TrendingUp}
          delay={100}
        />
        <StatCard
          title="معدل التحويل"
          value={stats.totalVisitors > 0 ? `${stats.conversionRate.toFixed(1)}%` : '—'}
          icon={ShoppingCart}
          delay={150}
        />
      </div>

      {topProducts.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 px-1">
          أفضل منتج: <span className="font-medium text-foreground">{topProducts[0].name}</span>
        </p>
      )}
    </div>
  );
};
