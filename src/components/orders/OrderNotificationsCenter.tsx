import { Bell, Check, Trash2, Package, XCircle, CreditCard, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { OrderNotification } from '@/hooks/useOrderNotifications';

const typeIcons = {
  new: Package,
  completed: Check,
  cancelled: XCircle,
  payment: CreditCard,
  refund: CreditCard,
  failed: AlertCircle,
};

interface OrderNotificationsCenterProps {
  notifications: OrderNotification[];
  unreadCount: number;
  onOpen: (orderId: string, notificationId: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
  className?: string;
}

const OrderNotificationsCenter = ({
  notifications,
  unreadCount,
  onOpen,
  onMarkAllRead,
  onClear,
  className,
}: OrderNotificationsCenterProps) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        className={cn('relative rounded-xl h-10 w-10 shrink-0', className)}
        aria-label="إشعارات الطلبات"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </PopoverTrigger>
    <PopoverContent
      className="w-[min(320px,calc(100vw-2rem))] p-0 rounded-2xl overflow-hidden"
      align="end"
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5 bg-muted/30">
        <span className="text-sm font-semibold">إشعارات الطلبات</span>
        <div className="flex gap-1">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg" onClick={onMarkAllRead}>
              <Check className="h-3.5 w-3.5 ml-1" />
              قراءة الكل
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClear}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="max-h-[min(360px,50vh)] overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">لا توجد إشعارات</p>
        ) : (
          notifications.map((n) => {
            const Icon = typeIcons[n.type];
            return (
              <button
                key={n.id}
                type="button"
                className={cn(
                  'w-full flex items-start gap-2.5 px-3 py-2.5 text-right border-b border-border/30 hover:bg-muted/40 transition-colors',
                  !n.read && 'bg-primary/5'
                )}
                onClick={() => onOpen(n.orderId, n.id)}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    n.type === 'new' && 'bg-warning/10 text-warning',
                    n.type === 'completed' && 'bg-success/10 text-success',
                    n.type === 'cancelled' && 'bg-destructive/10 text-destructive',
                    (n.type === 'payment' || n.type === 'refund') && 'bg-blue-500/10 text-blue-600',
                    n.type === 'failed' && 'bg-destructive/10 text-destructive'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{n.description}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {formatDistanceToNow(new Date(n.at), { addSuffix: true, locale: ar })}
                  </p>
                </div>
                {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </button>
            );
          })
        )}
      </div>
    </PopoverContent>
  </Popover>
);

export default OrderNotificationsCenter;
