
import { Users, UserPlus, Repeat } from "lucide-react";
import { StatCard } from "./StatCard";

interface CustomerStatsProps {
  stats: {
    newCustomers: number;
    returningCustomers: number;
  };
}

export const CustomerStats = ({ stats }: CustomerStatsProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">إحصائيات العملاء</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="عملاء جدد"
          value={stats.newCustomers.toLocaleString()}
          icon={UserPlus}
          delay={0}
        />
        <StatCard
          title="عملاء عائدون"
          value={stats.returningCustomers.toLocaleString()}
          icon={Repeat}
          delay={50}
        />
      </div>
    </div>
  );
};
