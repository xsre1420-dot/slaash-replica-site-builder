import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  iconClassName?: string;
  className?: string;
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  iconClassName,
  className,
}: StatCardProps) => (
  <div
    className={cn(
      'group rounded-2xl border border-border/50 bg-card p-5 shadow-soft hover:border-primary/15 transition-all duration-200',
      className
    )}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <p className="ds-stat-value truncate">{value}</p>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 mt-2 text-xs font-medium',
              trendUp === false ? 'text-destructive' : 'text-success'
            )}
          >
            {trendUp === false ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5" />
            )}
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div
        className={cn(
          'w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105',
          iconClassName
        )}
      >
        <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
      </div>
    </div>
  </div>
);

export default StatCard;
