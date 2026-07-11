import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  delay?: number;
  growth?: number;
}

export const StatCard = memo(function StatCard({
  title,
  value,
  icon: Icon,
  delay = 0,
  growth,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm',
        'hover:border-primary/15 hover:shadow-md transition-all duration-200'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3" dir="rtl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
          <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-lg sm:text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {growth != null && (
            <p className={cn('mt-1 text-xs font-medium', growth >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {growth >= 0 ? '+' : ''}
              {growth.toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
