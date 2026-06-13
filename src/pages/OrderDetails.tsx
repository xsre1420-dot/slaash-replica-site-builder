import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useOrderData } from "@/hooks/useOrderData";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import OrderDetailsCard from "@/components/order-details/OrderDetailsCard";
import OrderNotFound from "@/components/order-details/OrderNotFound";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrderPaymentSummary, OrderPaymentSummary } from "@/services/paymentService";
import { fetchOrderShipment, OrderShipmentData } from "@/services/deliveryService";
import { DeliveryStatus } from "@/utils/deliveryUtils";

const OrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { order, loading, patchOrderStatus } = useOrderData(orderId);
  const { user } = useAuth();
  const [paymentSummary, setPaymentSummary] = useState<OrderPaymentSummary | null>(null);
  const [shipmentData, setShipmentData] = useState<OrderShipmentData | null>(null);

  const loadPaymentSummary = useCallback(async () => {
    if (!orderId || !user?.id) return;
    const summary = await fetchOrderPaymentSummary(orderId, user.id);
    setPaymentSummary(summary);
  }, [orderId, user?.id]);

  const loadShipmentData = useCallback(async () => {
    if (!orderId || !user?.id) return;
    const data = await fetchOrderShipment(orderId, user.id);
    setShipmentData(data);
  }, [orderId, user?.id]);

  useEffect(() => {
    loadPaymentSummary();
    loadShipmentData();
  }, [loadPaymentSummary, loadShipmentData]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageHeader
          title="تفاصيل الطلب"
          description="جاري تحميل بيانات الطلب..."
          backTo="/orders"
          breadcrumbs={[
            { label: 'لوحة التحكم', href: '/builder' },
            { label: 'الطلبات', href: '/orders' },
            { label: 'التفاصيل' },
          ]}
        />
        <div className="ds-page max-w-4xl space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <PageHeader
          title="تفاصيل الطلب"
          description="الطلب غير موجود"
          backTo="/orders"
          breadcrumbs={[
            { label: 'لوحة التحكم', href: '/builder' },
            { label: 'الطلبات', href: '/orders' },
            { label: 'غير موجود' },
          ]}
        />
        <div className="ds-page max-w-4xl">
          <OrderNotFound />
        </div>
      </DashboardLayout>
    );
  }

  const shipmentDisplay: OrderShipmentData = shipmentData ?? {
    shipment: null,
    deliveryFee: order.deliveryFee ?? 0,
    deliveryStatus: (order.deliveryStatus || 'pending') as DeliveryStatus,
    events: [],
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={`طلب #${order.id.slice(0, 8)}`}
        description={`${order.customerInfo.name} · ${order.total.toLocaleString()} د.ع`}
        backTo="/orders"
        backLabel="العودة للطلبات"
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/builder' },
          { label: 'الطلبات', href: '/orders' },
          { label: `#${order.id.slice(0, 8)}` },
        ]}
      />
      <div className="ds-page max-w-4xl">
        <OrderDetailsCard
          order={order}
          paymentSummary={paymentSummary}
          shipmentData={shipmentDisplay}
          onPaymentUpdated={loadPaymentSummary}
          onShipmentUpdated={loadShipmentData}
          onOrderStatusUpdated={patchOrderStatus}
        />
      </div>
    </DashboardLayout>
  );
};

export default OrderDetails;
