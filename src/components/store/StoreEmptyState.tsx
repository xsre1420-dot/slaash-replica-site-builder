import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StoreEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

const StoreEmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: StoreEmptyStateProps) => (
  <div className={cn('sf-empty-state', className)}>
    <div className="sf-empty-state-icon" aria-hidden>
      {icon}
    </div>
    <h3 className="sf-empty-state-title">{title}</h3>
    <p className="sf-empty-state-desc">{description}</p>
    {action ? <div className="mt-6">{action}</div> : null}
  </div>
);

export default StoreEmptyState;
