import { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  className?: string;
  valueClassName?: string;
  onClick?: () => void;
  active?: boolean;
}

const StatCard = memo(function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  className,
  valueClassName,
  onClick,
  active,
}: StatCardProps) {
  const Comp = onClick ? 'button' : 'div';
  const valueStr = String(value);

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group rounded-2xl border border-border/50 bg-card p-3 sm:p-5 w-full min-w-0 text-right',
        'shadow-sm hover:border-primary/15 hover:shadow-md transition-all duration-200',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        active && 'border-primary/40 ring-2 ring-primary/15 bg-primary/[0.02]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3" dir="rtl">
        <div
          className={cn(
            'flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ring-1 ring-inset transition-colors',
            'bg-primary/10 ring-primary/15',
            iconClassName
          )}
        >
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-primary" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1 text-right">
          <p className="mb-0.5 sm:mb-1 text-[10px] font-medium text-muted-foreground sm:text-xs leading-snug">
            {label}
          </p>
          <p
            className={cn(
              'font-semibold tabular-nums tracking-tight text-foreground leading-tight',
              valueStr.length > 10 ? 'text-sm sm:text-base' : 'text-lg sm:text-2xl',
              valueClassName
            )}
          >
            {value}
          </p>
        </div>
      </div>
    </Comp>
  );
});

export default StatCard;
