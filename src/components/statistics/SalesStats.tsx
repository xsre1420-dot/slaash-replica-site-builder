
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
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
          <ShoppingCart className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">🛒 إحصائيات المبيعات</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="إجمالي المبيعات"
          value={`${stats.totalRevenue.toLocaleString()} د.ع`}
          growth={stats.revenueGrowth}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-[#6D63F2] to-[#5B52E8]"
        />
        <StatCard
          title="إجمالي الطلبات"
          value={stats.totalOrders.toLocaleString()}
          growth={stats.ordersGrowth}
          icon={Package}
          gradient="bg-gradient-to-br from-purple-500 to-purple-600"
        />
        <StatCard
          title="متوسط قيمة الطلب"
          value={`${stats.averageOrderValue.toLocaleString()} د.ع`}
          growth={5.2}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          title="أفضل المنتجات"
          value={topProducts.length > 0 ? topProducts[0].name : "لا توجد منتجات"}
          icon={Eye}
          gradient="bg-gradient-to-br from-green-500 to-green-600"
        />
      </div>
    </div>
  );
};
