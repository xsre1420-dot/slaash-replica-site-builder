import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useOrderData } from "@/hooks/useOrderData";
import { useAuth } from "@/context/AuthContext";
import OrderDetailsPageHeader from "@/components/order-details/OrderDetailsPageHeader";
import OrderDetailsCard from "@/components/order-details/OrderDetailsCard";
import OrderNotFound from "@/components/order-details/OrderNotFound";
import { fetchOrderPaymentSummary, OrderPaymentSummary } from "@/services/paymentService";

const OrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { order, loading } = useOrderData(orderId);
  const { user } = useAuth();
  const [paymentSummary, setPaymentSummary] = useState<OrderPaymentSummary | null>(null);

  const loadPaymentSummary = useCallback(async () => {
    if (!orderId || !user?.id) return;
    const summary = await fetchOrderPaymentSummary(orderId, user.id);
    setPaymentSummary(summary);
  }, [orderId, user?.id]);

  useEffect(() => {
    loadPaymentSummary();
  }, [loadPaymentSummary]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (!order) {
    return <OrderNotFound />;
  }

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OrderDetailsPageHeader orderId={order.id} />
      <div className="max-w-4xl mx-auto p-6">
        <OrderDetailsCard
          order={order}
          paymentSummary={paymentSummary}
          onPaymentUpdated={loadPaymentSummary}
        />
      </div>
    </div>
  );
};

export default OrderDetails;
