import { Order } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getSimplifiedOrderDisplayStatus,
  type SimplifiedOrderStatusKey,
} from '@/utils/orderWorkflowUtils';

const simplifiedStatusStyles: Record<SimplifiedOrderStatusKey, string> = {
  new: 'bg-warning/15 text-warning border-warning/30',
  processing: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
  shipping: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  completed: 'bg-success/15 text-success border-success/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  refunded: 'bg-destructive/15 text-destructive border-destructive/30',
};

interface OrderStatusBadgesProps {
  order: Order;
  compact?: boolean;
  className?: string;
}

export const OrderStatusBadges = ({
  order,
  compact = false,
  className,
}: OrderStatusBadgesProps) => {
  const { label, key } = getSimplifiedOrderDisplayStatus(order);

  return (
    <div className={cn('flex flex-wrap gap-1.5 justify-end', className)}>
      <Badge
        variant="outline"
        className={cn(
          'rounded-lg font-semibold border',
          simplifiedStatusStyles[key],
          compact && 'text-[10px] px-1.5 py-0'
        )}
      >
        {label}
      </Badge>
    </div>
  );
};

export default OrderStatusBadges;
