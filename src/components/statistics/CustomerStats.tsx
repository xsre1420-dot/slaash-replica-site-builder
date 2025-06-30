
import { Users, UserPlus, Repeat, DollarSign } from "lucide-react";
import { StatCard } from "./StatCard";

interface CustomerStatsProps {
  stats: {
    newCustomers: number;
    returningCustomers: number;
    customerLifetimeValue: number;
  };
}

export const CustomerStats = ({ stats }: CustomerStatsProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6D63F2' }}>
          <Users className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">👥 إحصائيات العملاء</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="عملاء جدد"
          value={stats.newCustomers.toLocaleString()}
          growth={18.5}
          icon={UserPlus}
          gradient="bg-gradient-to-br from-[#6D63F2] to-[#5B52E8]"
        />
        <StatCard
          title="عملاء عائدون"
          value={stats.returningCustomers.toLocaleString()}
          growth={12.3}
          icon={Repeat}
          gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
        />
        <StatCard
          title="قيمة العميل مدى الحياة"
          value={`${stats.customerLifetimeValue.toLocaleString()} د.ع`}
          growth={8.7}
          icon={DollarSign}
          gradient="bg-gradient-to-br from-green-500 to-green-600"
        />
      </div>
    </div>
  );
};
