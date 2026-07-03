import { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RichStatSubItem = {
  label: string;
  value: string | number;
  highlight?: boolean;
};

interface InventoryRichStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  subItems?: RichStatSubItem[];
  onClick?: () => void;
  active?: boolean;
  className?: string;
  subGridCols?: 2 | 3;
}

const InventoryRichStatCard = memo(function InventoryRichStatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  subItems,
  onClick,
  active,
  className,
  subGridCols = 2,
}: InventoryRichStatCardProps) {
  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-border/50 bg-card p-4 sm:p-5 w-full min-w-0 text-right',
        'shadow-sm hover:border-primary/15 hover:shadow-md transition-all duration-200',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        active && 'border-primary/40 ring-2 ring-primary/15 bg-primary/[0.02]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3" dir="rtl">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
            'bg-primary/10 ring-primary/15',
            iconClassName
          )}
        >
          <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
          <p className="text-xl sm:text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {subItems && subItems.length > 0 && (
            <div className={cn('mt-3 pt-3 border-t border-border/40 grid gap-x-3 gap-y-1.5', subGridCols === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {subItems.map((item) => (
                <div key={item.label} className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
                  <p
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      item.highlight ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                    )}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Comp>
  );
});

export default InventoryRichStatCard;
