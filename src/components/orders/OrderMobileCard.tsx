import { useState } from 'react';
import {
  BadgeCheck,
  Check,
  XCircle,
  Phone,
  MessageSquare,
  MapPin,
  Home,
  FileText,
  Printer,
  CreditCard,
  CalendarDays,
  User,
  Loader2,
} from 'lucide-react';
import { Order } from '@/types';
import { Button } from '@/components/ui/button';
import OrderStatusBadges from './OrderStatusBadges';
import OrderItems from './OrderItems';
import { formatOrderNumber, formatOrderDateTime, getOrderWorkflowCategory } from '@/utils/orderWorkflowUtils';
import { getPaymentMethodLabel } from '@/utils/paymentUtils';
import { printOrderInvoice } from '@/utils/orderExportUtils';
import { cn } from '@/lib/utils';
import { canTransitionOrderStatus } from '@/utils/orderStatusUtils';
import { toast } from 'sonner';

const workflowAccent: Record<string, string> = {
  new: 'bg-warning',
  completed: 'bg-success',
  cancelled: 'bg-destructive',
};

interface OrderMobileCardProps {
  order: Order;
  onUpdateStatus: (orderId: string, status: Order['status']) => void | Promise<boolean>;
  onClose?: () => void;
}

const DetailRow = ({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: typeof Phone;
  label: string;
  value?: string;
  dir?: 'ltr' | 'rtl';
}) => {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-start gap-2.5 text-right">
      <Icon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words" dir={dir}>
          {value}
        </p>
      </div>
    </div>
  );
};

const OrderMobileCard = ({ order, onUpdateStatus, onClose }: OrderMobileCardProps) => {
  const [pendingAction, setPendingAction] = useState<'complete' | 'complete-success' | 'cancel' | null>(null);
  const workflow = getOrderWorkflowCategory(order);
  const accent = workflowAccent[workflow] ?? 'bg-muted-foreground';
  const canComplete = canTransitionOrderStatus(order.status, 'completed');
  const canCancel = canTransitionOrderStatus(order.status, 'cancelled');
  const customer = order.customerInfo ?? { name: '', phone: '', address: '' };
  const items = order.items ?? [];
  const total = Number(order.total) || 0;
  const phoneDigits = (customer.phone ?? '').replace(/\D/g, '');

  const handlePrint = () => {
    const ok = printOrderInvoice(order);
    if (!ok) toast.error('تعذر فتح نافذة الطباعة — تحقق من حظر النوافذ المنبثقة');
  };

  const handleStatusChange = async (status: Order['status']) => {
    if (pendingAction) return;

    setPendingAction(status === 'completed' ? 'complete' : 'cancel');
    try {
      const result = await onUpdateStatus(order.id, status);
      if (result === false) return;

      if (status === 'completed') {
        setPendingAction('complete-success');
        await new Promise((resolve) => setTimeout(resolve, 650));
        onClose?.();
      } else {
        onClose?.();
      }
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm',
        order.status === 'cancelled' && 'opacity-75'
      )}
    >
      <span className={cn('absolute inset-y-0 right-0 w-1', accent)} aria-hidden="true" />

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="text-right min-w-0">
                <p className="font-bold text-foreground">{formatOrderNumber(order.id)}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                  <CalendarDays className="w-3 h-3 shrink-0" />
                  {formatOrderDateTime(order.date)}
                </p>
              </div>
              <div className="text-left shrink-0">
                <p className="font-bold text-xl text-foreground tabular-nums leading-tight">
                  {total.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">د.ع</p>
              </div>
            </div>
            <OrderStatusBadges order={order} compact className="justify-end" />
          </div>
        </div>

        {/* Customer */}
        <section className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2.5">
          <p className="text-xs font-bold text-foreground text-right">معلومات العميل</p>
          <DetailRow icon={User} label="الاسم" value={customer.name} />
          <DetailRow icon={Phone} label="الهاتف" value={customer.phone} dir="ltr" />
          <DetailRow icon={MapPin} label="المحافظة" value={customer.governorate} />
          <DetailRow icon={Home} label="العنوان" value={customer.address} />
          <DetailRow icon={FileText} label="ملاحظات العميل" value={customer.notes} />
        </section>

        {/* Products */}
        <section className="space-y-2">
          <p className="text-xs font-bold text-foreground text-right">المنتجات</p>
          {items.length > 0 ? (
            <OrderItems items={items} />
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
              لا توجد منتجات في هذا الطلب
            </div>
          )}
        </section>

        {/* Order summary */}
        <section className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold tabular-nums">{total.toLocaleString()} د.ع</span>
            <span className="text-muted-foreground">الإجمالي</span>
          </div>
          {order.discountAmount != null && order.discountAmount > 0 && (
            <div className="flex items-center justify-between gap-2 text-primary">
              <span className="font-medium tabular-nums">-{order.discountAmount.toLocaleString()} د.ع</span>
              <span>الخصم{order.couponCode ? ` (${order.couponCode})` : ''}</span>
            </div>
          )}
          {order.deliveryFee != null && order.deliveryFee > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium tabular-nums">{order.deliveryFee.toLocaleString()} د.ع</span>
              <span className="text-muted-foreground">التوصيل</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
            <span className="text-xs font-medium">{getPaymentMethodLabel(order.paymentMethod)}</span>
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              طريقة الدفع
            </span>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
          {phoneDigits && (
            <>
              <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0" asChild>
                <a href={`tel:${phoneDigits}`} aria-label="اتصال">
                  <Phone className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0" asChild>
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="واتساب"
                >
                  <MessageSquare className="w-4 h-4" />
                </a>
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-10 gap-1.5 shrink-0"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            فاتورة
          </Button>
          <div className="flex-1 flex gap-2 justify-end min-w-0">
            {canComplete && (
              <Button
                size="sm"
                disabled={!!pendingAction}
                className={cn(
                  'rounded-xl h-10 flex-1 max-w-[150px] gap-1.5 shadow-sm transition-all duration-200',
                  pendingAction === 'complete-success'
                    ? 'bg-success text-success-foreground hover:bg-success'
                    : 'bg-success hover:bg-success/90 text-success-foreground'
                )}
                onClick={() => void handleStatusChange('completed')}
              >
                {pendingAction === 'complete-success' ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                    مكتمل
                  </>
                ) : pendingAction === 'complete' ? (
                  <>
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                    جاري التأكيد...
                  </>
                ) : (
                  <>
                    <BadgeCheck className="w-4 h-4 shrink-0" strokeWidth={2.25} />
                    تأكيد الطلب
                  </>
                )}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                disabled={!!pendingAction}
                className="rounded-xl h-10 flex-1 max-w-[110px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => void handleStatusChange('cancelled')}
              >
                {pendingAction === 'cancel' ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
                )}
                إلغاء
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default OrderMobileCard;
