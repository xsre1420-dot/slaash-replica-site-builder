import { format } from 'date-fns';
import { Package, CreditCard, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildOrderTimelineEvents } from '@/utils/orderWorkflowUtils';
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

  if (order.status === 'cancelled') {
    events.unshift({
      id: 'cancel-highlight',
      title: 'تم إلغاء الطلب',
      at: order.date,
      kind: 'order',
    });
  }

  const uniqueEvents = events.filter(
    (ev, idx, arr) => arr.findIndex((e) => e.id === ev.id) === idx
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h3 className="text-base font-bold text-foreground mb-4 text-right flex items-center gap-2 justify-end">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        سجل الطلب
      </h3>
      <div className="relative pr-4">
        <div className="absolute top-2 bottom-2 right-[7px] w-px bg-border" />
        <div className="space-y-4">
          {uniqueEvents.map((event, index) => {
            const Icon = kindIcons[event.kind];
            return (
              <div key={`${event.id}-${index}`} className="relative flex gap-3 items-start">
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                    kindStyles[event.kind]
                  )}
                >
                  {event.title.includes('إلغاء') ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 text-right pt-0.5 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{event.title}</p>
                  {event.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.detail}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {format(new Date(event.at), 'yyyy-MM-dd · hh:mm a')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderTimeline;
