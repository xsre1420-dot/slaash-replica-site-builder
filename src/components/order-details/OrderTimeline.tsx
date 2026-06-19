import { format } from 'date-fns';
import { Package, CreditCard, Truck, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildOrderTimelineEvents,
  FULFILLMENT_STEPS,
  getFulfillmentStepIndex,
  getOrderFulfillmentStep,
} from '@/utils/orderWorkflowUtils';
import { Order } from '@/types';
import { ShipmentTrackingEvent } from '@/services/deliveryService';

interface OrderTimelineProps {
  order: Order;
  shipmentEvents?: ShipmentTrackingEvent[];
}

const kindStyles = {
  order: 'bg-primary/10 text-primary border-primary/20',
  payment: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  delivery: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
};

const kindIcons = {
  order: Package,
  payment: CreditCard,
  delivery: Truck,
};

const OrderTimeline = ({ order, shipmentEvents = [] }: OrderTimelineProps) => {
  const events = buildOrderTimelineEvents(order, shipmentEvents);
  const currentStep = getOrderFulfillmentStep(order);
  const currentIndex = getFulfillmentStepIndex(currentStep);

  const uniqueEvents = events.filter(
    (ev, idx, arr) => arr.findIndex((e) => e.id === ev.id) === idx
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm min-w-0">
      <h3 className="text-sm sm:text-base font-bold text-foreground mb-4 text-right flex items-center gap-2 justify-end">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        سجل الطلب
      </h3>

      {order.status !== 'cancelled' && (
        <div className="mb-5 rounded-xl bg-muted/30 p-3 overflow-x-auto scrollbar-none" dir="rtl">
          <div className="flex items-center gap-1 min-w-max">
            {FULFILLMENT_STEPS.map((step, index) => {
              const done = index <= currentIndex;
              const active = index === currentIndex;
              return (
                <div key={step.id} className="flex items-center gap-1">
                  <div className="flex flex-col items-center min-w-[48px]">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        done ? (active ? 'bg-primary ring-2 ring-primary/30' : 'bg-primary/60') : 'bg-muted-foreground/30'
                      )}
                    />
                    <span
                      className={cn(
                        'text-[8px] mt-1 font-medium',
                        active ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < FULFILLMENT_STEPS.length - 1 && (
                    <div className={cn('h-px w-4 sm:w-6', done ? 'bg-primary/40' : 'bg-border')} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative pr-4">
        <div className="absolute top-2 bottom-2 right-[7px] w-px bg-border" />
        <div className="space-y-4">
          {uniqueEvents.map((event, index) => {
            const Icon = kindIcons[event.kind];
            const isCancel = event.title.includes('إلغاء');
            return (
              <div key={`${event.id}-${index}`} className="relative flex gap-3 items-start">
                <div
                  className={cn(
                    'relative z-10 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border',
                    isCancel ? 'bg-destructive/10 text-destructive border-destructive/20' : kindStyles[event.kind]
                  )}
                >
                  {isCancel ? <XCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 text-right pt-0.5 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{event.title}</p>
                  {event.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.detail}</p>
                  )}
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1">
                    {format(new Date(event.at), 'yyyy-MM-dd · hh:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
          {uniqueEvents.length === 0 && (
            <div className="flex gap-3 items-center text-muted-foreground text-sm justify-end">
              <span>لا توجد أحداث بعد</span>
              <Circle className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderTimeline;
