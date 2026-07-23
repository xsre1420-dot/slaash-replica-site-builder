import { Order } from '@/types';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import OrderMobileCard from './OrderMobileCard';
import { formatOrderNumber } from '@/utils/orderWorkflowUtils';
import { cn } from '@/lib/utils';

interface OrderDetailSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (orderId: string, status: Order['status']) => void | Promise<boolean>;
}

const OrderDetailSheet = ({
  order,
  open,
  onOpenChange,
  onUpdateStatus,
}: OrderDetailSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="bottom"
      dir="rtl"
      className={cn(
        'max-h-[92vh] overflow-y-auto rounded-t-2xl px-0 pb-8 pt-3',
        'sm:max-w-lg sm:mx-auto sm:left-0 sm:right-0',
        '[&>button]:hidden'
      )}
    >
      <div className="flex justify-center pb-2" aria-hidden="true">
        <div className="h-1 w-10 rounded-full bg-border/70" />
      </div>

      <div className="relative px-4 pb-3">
        <SheetClose asChild>
          <button
            type="button"
            className="absolute right-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            aria-label="إغلاق تفاصيل الطلب"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </SheetClose>

        <SheetHeader className="space-y-1 px-10 text-center sm:text-center">
          <SheetTitle className="text-base font-bold leading-snug">
            {order ? `تفاصيل ${formatOrderNumber(order.id)}` : 'تفاصيل الطلب'}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            معلومات العميل والمنتجات وإجراءات الطلب
          </SheetDescription>
        </SheetHeader>
      </div>

      {order && (
        <div className="px-3 sm:px-4">
          <OrderMobileCard
            order={order}
            onUpdateStatus={onUpdateStatus}
            onClose={() => onOpenChange(false)}
          />
        </div>
      )}
    </SheetContent>
  </Sheet>
);

export default OrderDetailSheet;
