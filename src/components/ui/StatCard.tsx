import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  className?: string;
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  iconClassName,
  className,
}: StatCardProps) => (
  <div
    className={cn(
      'group rounded-2xl border border-border/50 bg-card p-4 sm:p-5',
      'shadow-sm hover:border-primary/15 hover:shadow-md transition-all duration-200',
      className
    )}
  >
    <div className="flex items-start justify-between gap-3" dir="rtl">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors',
          'bg-primary/10 ring-primary/15',
          iconClassName
        )}
      >
        <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1 text-right">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p>
        <p className="truncate text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {value}
        </p>
      </div>
    </div>
  </div>
);

export default StatCard;
