import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border/80 bg-muted/20',
      className
    )}
    role="status"
  >
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
      <Icon className="w-8 h-8 text-primary" strokeWidth={1.5} />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <Button onClick={onAction} className="rounded-xl min-h-[44px] px-6 shadow-md shadow-primary/10">
        {actionLabel}
      </Button>
    )}
  </div>
);

export default EmptyState;
