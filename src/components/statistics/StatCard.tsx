
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  growth?: number;
  icon: React.ComponentType<{ className?: string }>;
  gradient?: string;
  suffix?: string;
  delay?: number;
}

export const StatCard = ({ title, value, growth, icon: Icon, gradient, suffix = "", delay = 0 }: StatCardProps) => (
  <Card 
    className="border border-border shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 animate-fade-in bg-card"
    style={{ animationDelay: `${delay}ms` }}
  >
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-right flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}{suffix}</p>
          {growth !== undefined && growth !== 0 && (
            <div className={`flex items-center gap-1 mt-2 justify-end ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {growth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span className="text-xs font-medium">{growth >= 0 ? '+' : ''}{growth.toFixed(1)}%</span>
            </div>
          )}
          {growth === 0 && growth !== undefined && (
            <div className="flex items-center gap-1 mt-2 justify-end text-muted-foreground">
              <span className="text-xs font-medium">0%</span>
            </div>
          )}
        </div>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-primary/10 mr-3">
          <Icon className="w-7 h-7 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);
