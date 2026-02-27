import { useParams } from "react-router-dom";
import { useOrderData } from "@/hooks/useOrderData";
import OrderDetailsPageHeader from "@/components/order-details/OrderDetailsPageHeader";
import OrderDetailsCard from "@/components/order-details/OrderDetailsCard";
import OrderNotFound from "@/components/order-details/OrderNotFound";

const OrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { order } = useOrderData(orderId);

  if (!order) {
    return <OrderNotFound />;
  }

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <OrderDetailsPageHeader orderId={order.id} />
      <div className="max-w-4xl mx-auto p-6">
        <OrderDetailsCard order={order} />
      </div>
    </div>
  );
};

export default OrderDetails;