import {
  Package,
  ClipboardCheck,
  ChefHat,
  PackageCheck,
  Truck,
  MapPinCheck,
} from 'lucide-react';
import { Order } from '@/types';
import { cn } from '@/lib/utils';
import {
  FULFILLMENT_STEPS,
  getFulfillmentStepIndex,
  getOrderFulfillmentStep,
} from '@/utils/orderWorkflowUtils';

const stepIcons = {
  new: Package,
  confirmed: ClipboardCheck,
  preparing: ChefHat,
  ready: PackageCheck,
  shipped: Truck,
  delivered: MapPinCheck,
};

interface OrderWorkflowProgressProps {
  order: Order;
  compact?: boolean;
  className?: string;
}

const OrderWorkflowProgress = ({ order, compact = false, className }: OrderWorkflowProgressProps) => {
  if (order.status === 'cancelled') {
    return (
      <div className={cn('rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-right', className)}>
        <p className="text-xs font-semibold text-destructive">تم إلغاء الطلب</p>
      </div>
    );
  }

  const currentStep = getOrderFulfillmentStep(order);
  const currentIndex = getFulfillmentStepIndex(currentStep);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5', className)} dir="rtl">
        {FULFILLMENT_STEPS.map((step, index) => {
          const done = index <= currentIndex;
          const active = index === currentIndex;
          return (
            <div
              key={step.id}
              className={cn(
                'h-1.5 rounded-full shrink-0 transition-all',
                done ? (active ? 'w-6 bg-primary' : 'w-3 bg-primary/50') : 'w-3 bg-muted'
              )}
              title={step.label}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border/50 bg-muted/20 p-3 sm:p-4', className)} dir="rtl">
      <p className="text-[11px] font-semibold text-muted-foreground mb-3 text-right">مسار التنفيذ</p>
      <div className="flex items-start justify-between gap-1 overflow-x-auto scrollbar-none pb-1">
        {FULFILLMENT_STEPS.map((step, index) => {
          const Icon = stepIcons[step.id];
          const done = index <= currentIndex;
          const active = index === currentIndex;
          return (
            <div key={step.id} className="flex flex-col items-center min-w-[52px] flex-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  done
                    ? active
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-background border-border text-muted-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p
                className={cn(
                  'mt-1.5 text-[9px] sm:text-[10px] font-medium text-center leading-tight',
                  active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderWorkflowProgress;
