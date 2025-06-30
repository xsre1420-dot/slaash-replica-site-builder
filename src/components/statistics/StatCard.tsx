
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  growth?: number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  suffix?: string;
}

export const StatCard = ({ title, value, growth, icon: Icon, gradient, suffix = "" }: StatCardProps) => (
  <Card className="border-0 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="text-right">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}{suffix}</p>
          {growth !== undefined && (
            <div className={`flex items-center gap-1 mt-2 ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">{growth >= 0 ? '+' : ''}{growth}%</span>
            </div>
          )}
        </div>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${gradient}`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);
