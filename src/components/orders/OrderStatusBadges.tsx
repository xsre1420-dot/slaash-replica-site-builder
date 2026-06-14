import { Order } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getOrderStatusLabel,
  getOrderWorkflowCategory,
  getWorkflowTabLabel,
  getEffectivePaymentStatus,
  getEffectiveDeliveryStatus,
} from '@/utils/orderWorkflowUtils';
import { getPaymentStatusLabel } from '@/utils/paymentUtils';
import { getDeliveryStatusLabel } from '@/utils/deliveryUtils';

const orderStatusStyles: Record<Order['status'], string> = {
  pending: 'bg-warning/15 text-warning border-warning/30',
  completed: 'bg-success/15 text-success border-success/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const paymentStatusStyles: Record<string, string> = {
  pending_collection: 'bg-muted text-muted-foreground border-border',
  collected: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  paid: 'bg-success/15 text-success border-success/30',
  refunded: 'bg-destructive/15 text-destructive border-destructive/30',
  partially_refunded: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
  disputed: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
};

const deliveryStatusStyles: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground border-border',
  preparing: 'bg-warning/15 text-warning border-warning/30',
  shipped: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  out_for_delivery: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
  delivered: 'bg-success/15 text-success border-success/30',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
  returned: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
};

interface OrderStatusBadgesProps {
  order: Order;
  compact?: boolean;
  showWorkflow?: boolean;
  className?: string;
}

export const OrderStatusBadges = ({
  order,
  compact = false,
  showWorkflow = false,
  className,
}: OrderStatusBadgesProps) => {
  const workflow = getOrderWorkflowCategory(order);

  return (
    <div className={cn('flex flex-wrap gap-1.5 justify-end', className)}>
      {showWorkflow && (
        <Badge variant="outline" className="rounded-lg text-[10px] font-semibold border-primary/30 text-primary bg-primary/5">
          {getWorkflowTabLabel(workflow)}
        </Badge>
      )}
      <Badge variant="outline" className={cn('rounded-lg font-semibold border', orderStatusStyles[order.status], compact && 'text-[10px] px-1.5 py-0')}>
        {getOrderStatusLabel(order.status)}
      </Badge>
      {getEffectivePaymentStatus(order) && (
        <Badge variant="outline" className={cn('rounded-lg font-semibold border', paymentStatusStyles[getEffectivePaymentStatus(order)] ?? 'bg-muted', compact && 'text-[10px] px-1.5 py-0')}>
          {getPaymentStatusLabel(getEffectivePaymentStatus(order))}
        </Badge>
      )}
      <Badge variant="outline" className={cn('rounded-lg font-semibold border', deliveryStatusStyles[getEffectiveDeliveryStatus(order)] ?? 'bg-muted', compact && 'text-[10px] px-1.5 py-0')}>
        {getDeliveryStatusLabel(getEffectiveDeliveryStatus(order))}
      </Badge>
    </div>
  );
};

export default OrderStatusBadges;
