
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  growth?: number;
  icon: React.ComponentType<{ className?: string }>;
  gradient?: string;
  suffix?: string;
  delay?: number;
}

export const StatCard = ({ title, value, growth, icon: Icon, suffix = "", delay = 0 }: StatCardProps) => (
  <Card
    className="group overflow-hidden animate-fade-in hover:border-primary/15 transition-all duration-200"
    style={{ animationDelay: `${delay}ms` }}
  >
    <CardContent className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-right flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-2 truncate">{title}</p>
          <p className="ds-stat-value truncate">{value}{suffix}</p>
          {growth !== undefined && growth !== 0 && (
            <div className={cn(
              "flex items-center gap-1 mt-2 justify-end text-xs font-medium",
              growth >= 0 ? 'text-success' : 'text-destructive'
            )}>
              {growth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{growth >= 0 ? '+' : ''}{growth.toFixed(1)}%</span>
            </div>
          )}
          {growth === 0 && growth !== undefined && (
            <div className="flex items-center gap-1 mt-2 justify-end text-muted-foreground">
              <span className="text-xs font-medium">0%</span>
            </div>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10 shrink-0 transition-transform duration-200 group-hover:scale-105">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);
