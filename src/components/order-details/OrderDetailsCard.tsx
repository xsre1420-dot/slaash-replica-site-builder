import { useState } from 'react';
import { Order } from '@/types';
import CustomerInfo from './CustomerInfo';
import OrderItems from './OrderItems';
import OrderTotal from './OrderTotal';
import OrderPaymentCard from './OrderPaymentCard';
import OrderShipmentCard from './OrderShipmentCard';
import OrderTimeline from './OrderTimeline';
import OrderActionsBar from './OrderActionsBar';
import OrderStatusBadges from '@/components/orders/OrderStatusBadges';
import { OrderPaymentSummary } from '@/services/paymentService';
import { OrderShipmentData } from '@/services/deliveryService';
import { formatOrderNumber } from '@/utils/orderWorkflowUtils';
import { format } from 'date-fns';
import { getPaymentMethodLabel } from '@/utils/paymentUtils';
import { useAuth } from '@/context/AuthContext';
import { Calendar, CreditCard } from 'lucide-react';

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

  const handleRefreshAll = () => {
    onPaymentUpdated?.();
    onShipmentUpdated?.();
    onOrderUpdated?.();
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header summary */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="accent-gradient px-5 py-5 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-right">
              <p className="text-sm text-primary-foreground/80">طلب {formatOrderNumber(order.id)}</p>
              <h1 className="text-2xl font-bold mt-1">{order.customerInfo.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-primary-foreground/90 justify-end">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(order.date), 'yyyy-MM-dd · hh:mm a')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CreditCard className="w-4 h-4" />
                  {getPaymentMethodLabel(order.paymentMethod)}
                </span>
              </div>
            </div>
            <div className="text-left sm:text-left">
              <p className="text-3xl font-bold">{order.total.toLocaleString()} د.ع</p>
              <p className="text-sm text-primary-foreground/80 mt-1">{order.items.length} منتج</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 bg-muted/20 border-t border-border/40">
          <OrderStatusBadges order={order} showWorkflow />
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
          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="text-base font-bold text-foreground mb-4 text-right">معلومات العميل</h2>
            <CustomerInfo
              customerInfo={order.customerInfo}
              orderId={order.id}
              ownerId={user?.id}
            />
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="text-base font-bold text-foreground mb-4 text-right">المنتجات</h2>
            <OrderItems items={order.items} />
          </section>

          <OrderTimeline order={order} shipmentEvents={shipmentData?.events} />
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card p-5 xl:sticky xl:top-24">
            <h2 className="text-base font-bold text-foreground mb-4 text-right">ملخص الطلب</h2>
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
