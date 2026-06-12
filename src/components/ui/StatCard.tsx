import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  iconClassName?: string;
  className?: string;
}

const StatCard = ({ label, value, icon: Icon, trend, iconClassName, className }: StatCardProps) => (
  <div
    className={cn(
      'rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200',
      className
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground tracking-tight truncate">{value}</p>
        {trend && <p className="text-xs text-primary mt-1">{trend}</p>}
      </div>
      <div className={cn('w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0', iconClassName)}>
        <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
      </div>
    </div>
  </div>
);

export default StatCard;
