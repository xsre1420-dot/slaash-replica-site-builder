import { useState, useEffect } from 'react';
import { Order } from '@/types';
import CustomerInfo from './CustomerInfo';
import OrderItems from './OrderItems';
import OrderTotal from './OrderTotal';
import OrderPaymentCard from './OrderPaymentCard';
import OrderShipmentCard from './OrderShipmentCard';
import OrderTimeline from './OrderTimeline';
import OrderActionsBar from './OrderActionsBar';
import OrderStatusBadges from '@/components/orders/OrderStatusBadges';
import OrderWorkflowProgress from '@/components/orders/OrderWorkflowProgress';
import { OrderPaymentSummary } from '@/services/paymentService';
import { OrderShipmentData } from '@/services/deliveryService';
import { fetchCustomerInsightsByPhone } from '@/services/orderService';
import { formatOrderNumber } from '@/utils/orderWorkflowUtils';
import { printOrderInvoice, printShippingLabel } from '@/utils/orderExportUtils';
import { format } from 'date-fns';
import { getPaymentMethodLabel } from '@/utils/paymentUtils';
import { useAuth } from '@/context/AuthContext';
import { Calendar, CreditCard, Printer, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OrderDetailsCardProps {
  order: Order;
  paymentSummary?: OrderPaymentSummary | null;
  shipmentData?: OrderShipmentData | null;
  onPaymentUpdated?: () => void;
  onShipmentUpdated?: () => void;
  onOrderUpdated?: () => void;
  onOrderStatusUpdated?: (status: Order['status']) => void;
}

const OrderDetailsCard = ({
  order,
  paymentSummary,
  shipmentData,
  onPaymentUpdated,
  onShipmentUpdated,
  onOrderUpdated,
}: OrderDetailsCardProps) => {
  const { user } = useAuth();
  const [refundTrigger, setRefundTrigger] = useState(0);
  const [customerInsights, setCustomerInsights] = useState<{ orderCount: number; totalSpent: number } | null>(null);

  useEffect(() => {
    if (!user?.id || !order.customerInfo.phone) return;
    void fetchCustomerInsightsByPhone(user.id, order.customerInfo.phone).then(setCustomerInsights);
  }, [user?.id, order.customerInfo.phone, order.id]);

  const handlePrint = () => {
    const ok = printOrderInvoice(order);
    if (!ok) toast.error('تعذر فتح نافذة الطباعة — تحقق من حظر النوافذ المنبثقة');
  };

  const handlePrintShippingLabel = () => {
    const ok = printShippingLabel(order, {
      trackingNumber: shipmentData?.shipment?.tracking_number,
      carrier: shipmentData?.shipment?.carrier,
    });
    if (!ok) toast.error('تعذر فتح نافذة الطباعة — تحقق من حظر النوافذ المنبثقة');
  };

  const handleRefreshAll = () => {
    onPaymentUpdated?.();
    onShipmentUpdated?.();
    onOrderUpdated?.();
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header summary */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="bg-primary px-4 sm:px-5 py-4 sm:py-5 text-primary-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="text-right min-w-0">
              <p className="text-xs sm:text-sm text-primary-foreground/80">
                طلب {formatOrderNumber(order.id)}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold mt-1 truncate">{order.customerInfo.name}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs sm:text-sm text-primary-foreground/90 justify-end">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {format(new Date(order.date), 'yyyy-MM-dd · hh:mm a')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {getPaymentMethodLabel(order.paymentMethod)}
                </span>
              </div>
            </div>
            <div className="flex items-end justify-between sm:flex-col sm:items-end gap-2">
              <div className="text-left">
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                  {order.total.toLocaleString()} د.ع
                </p>
                <p className="text-xs sm:text-sm text-primary-foreground/80 mt-0.5">
                  {order.items.length} منتج
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end sm:flex-col sm:items-end">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl gap-1.5 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 border-0 h-9"
                  onClick={handlePrint}
                >
                  <Printer className="w-3.5 h-3.5" />
                  فاتورة
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl gap-1.5 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 border-0 h-9"
                  onClick={handlePrintShippingLabel}
                >
                  <Truck className="w-3.5 h-3.5" />
                  ملصق شحن
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 sm:px-5 py-3 sm:py-4 bg-muted/20 border-t border-border/40 space-y-3">
          <OrderStatusBadges order={order} />
          <OrderWorkflowProgress order={order} />
        </div>
      </div>

      <OrderActionsBar
        order={order}
        shipmentData={shipmentData}
        paymentSummary={paymentSummary}
        onOrderUpdated={handleRefreshAll}
        onRefundRequest={() => setRefundTrigger((n) => n + 1)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
            <h2 className="text-sm sm:text-base font-bold text-foreground mb-4 text-right">معلومات العميل</h2>
            <CustomerInfo
              customerInfo={order.customerInfo}
              orderId={order.id}
              ownerId={user?.id}
              customerInsights={customerInsights ?? undefined}
            />
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
            <h2 className="text-sm sm:text-base font-bold text-foreground mb-4 text-right">المنتجات</h2>
            <OrderItems items={order.items} />
          </section>

          <OrderTimeline order={order} shipmentEvents={shipmentData?.events} />
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 xl:sticky xl:top-24 shadow-sm">
            <h2 className="text-sm sm:text-base font-bold text-foreground mb-4 text-right">ملخص الطلب</h2>
            <OrderTotal
              total={order.total}
              selectedGovernorate={order.customerInfo.governorate}
              discountAmount={order.discountAmount}
              couponCode={order.couponCode}
              deliveryFee={order.deliveryFee ?? shipmentData?.deliveryFee}
            />
          </section>

          {shipmentData && (
            <OrderShipmentCard data={shipmentData} onUpdated={() => onShipmentUpdated?.()} />
          )}

          {paymentSummary ? (
            <OrderPaymentCard
              key={refundTrigger}
              order={order}
              summary={paymentSummary}
              onUpdated={() => onPaymentUpdated?.()}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
              تعذر تحميل بيانات الدفع. حاول تحديث الصفحة.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsCard;
