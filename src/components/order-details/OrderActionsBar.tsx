import { useState } from 'react';
import {
  Loader2,
  Package,
  Truck,
  MapPinCheck,
  XCircle,
  RotateCcw,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Order } from '@/types';
import { OrderPaymentSummary } from '@/services/paymentService';
import { OrderShipmentData } from '@/services/deliveryService';
import { updateOrderStatus } from '@/services/orderService';
import { updateShipmentStatus, fetchOrderShipment } from '@/services/deliveryService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { canTransitionOrderStatus } from '@/utils/orderStatusUtils';
import { DeliveryStatus } from '@/utils/deliveryUtils';

interface OrderActionsBarProps {
  order: Order;
  shipmentData?: OrderShipmentData | null;
  paymentSummary?: OrderPaymentSummary | null;
  onOrderUpdated: () => void;
  onRefundRequest?: () => void;
}

type ActionId =
  | 'confirm'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancel'
  | 'refund';

const OrderActionsBar = ({
  order,
  shipmentData,
  paymentSummary,
  onOrderUpdated,
  onRefundRequest,
}: OrderActionsBarProps) => {
  const { user } = useAuth();
  const [loadingAction, setLoadingAction] = useState<ActionId | null>(null);

  const shipmentId = shipmentData?.shipment?.id;
  const deliveryStatus = shipmentData?.deliveryStatus ?? order.deliveryStatus ?? 'pending';

  const runShipmentUpdate = async (status: DeliveryStatus, actionId: ActionId, alsoComplete = false) => {
    if (!user?.id) return;
    setLoadingAction(actionId);
    try {
      let activeShipmentId = shipmentId;

      if (!activeShipmentId) {
        const shipment = await fetchOrderShipment(order.id, user.id);
        activeShipmentId = shipment?.shipment?.id;
      }

      if (!activeShipmentId) {
        throw new Error('لم يتم العثور على سجل الشحن. انتظر لحظة ثم حاول مرة أخرى.');
      }

      const result = await updateShipmentStatus(activeShipmentId, user.id, status, {
        note: `تحديث تلقائي: ${status}`,
      });
      if (!result.success) throw new Error(result.error);

      if (alsoComplete && canTransitionOrderStatus(order.status, 'completed')) {
        const orderResult = await updateOrderStatus(order.id, user.id, 'completed');
        if (!orderResult.success) throw new Error(orderResult.error);
      }

      toast.success('تم تحديث الطلب بنجاح');
      onOrderUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل تحديث الطلب');
    } finally {
      setLoadingAction(null);
    }
  };

  const runCancel = async () => {
    if (!user?.id || !canTransitionOrderStatus(order.status, 'cancelled')) return;
    if (!confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return;
    setLoadingAction('cancel');
    try {
      const result = await updateOrderStatus(order.id, user.id, 'cancelled');
      if (!result.success) throw new Error(result.error);
      toast.success('تم إلغاء الطلب');
      onOrderUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل الإلغاء');
    } finally {
      setLoadingAction(null);
    }
  };

  const actions: {
    id: ActionId;
    label: string;
    icon: typeof Package;
    variant?: 'default' | 'outline' | 'destructive';
    visible: boolean;
    onClick: () => void;
  }[] = [
    {
      id: 'confirm',
      label: 'تأكيد الطلب',
      icon: ClipboardCheck,
      visible: order.status === 'pending' && deliveryStatus === 'pending',
      onClick: () => void runShipmentUpdate('preparing', 'confirm'),
    },
    {
      id: 'processing',
      label: 'قيد المعالجة',
      icon: Package,
      visible: order.status === 'pending' && ['pending', 'preparing'].includes(deliveryStatus),
      onClick: () => void runShipmentUpdate('preparing', 'processing'),
    },
    {
      id: 'shipped',
      label: 'تم الشحن',
      icon: Truck,
      visible:
        order.status !== 'cancelled' &&
        !['shipped', 'out_for_delivery', 'delivered'].includes(deliveryStatus),
      onClick: () => void runShipmentUpdate('shipped', 'shipped'),
    },
    {
      id: 'delivered',
      label: 'تم التسليم',
      icon: MapPinCheck,
      visible: order.status !== 'cancelled' && deliveryStatus !== 'delivered',
      onClick: () => void runShipmentUpdate('delivered', 'delivered', true),
    },
    {
      id: 'cancel',
      label: 'إلغاء الطلب',
      icon: XCircle,
      variant: 'destructive',
      visible: canTransitionOrderStatus(order.status, 'cancelled'),
      onClick: () => void runCancel(),
    },
    {
      id: 'refund',
      label: 'استرداد',
      icon: RotateCcw,
      variant: 'outline',
      visible:
        !!paymentSummary &&
        paymentSummary.remainingRefundable > 0 &&
        order.status === 'completed',
      onClick: () => onRefundRequest?.(),
    },
  ];

  const visibleActions = actions.filter((a) => a.visible);
  if (visibleActions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-3 text-right">إجراءات سريعة</h3>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 justify-end">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const isLoading = loadingAction === action.id;
          const isPrimary = action.id === 'delivered' || action.id === 'confirm';
          return (
            <Button
              key={action.id}
              variant={action.variant ?? 'default'}
              size="sm"
              disabled={!!loadingAction}
              onClick={action.onClick}
              className={cn(
                'rounded-xl gap-1.5 min-h-[44px] font-semibold text-xs sm:text-sm',
                isPrimary && 'col-span-2 sm:col-span-1',
                action.id === 'delivered' && 'bg-success hover:bg-success/90 text-success-foreground',
                action.id === 'confirm' && 'bg-primary',
                action.id === 'cancel' && 'col-span-2 sm:col-span-1'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              {action.label}
            </Button>
          );
        })}
      </div>
      {!shipmentId && order.status === 'pending' && (
        <p className="text-xs text-muted-foreground mt-3 text-right">
          جاري تحميل بيانات الشحن… إذا استمرت المشكلة، استخدم بطاقة الشحن أدناه.
        </p>
      )}
    </div>
  );
};

export default OrderActionsBar;
