import { Order } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import CustomerInfo from "./CustomerInfo";
import OrderItems from "./OrderItems";
import OrderTotal from "./OrderTotal";
import OrderHeader from "./OrderHeader";
import OrderPaymentCard from "./OrderPaymentCard";
import OrderShipmentCard from "./OrderShipmentCard";
import { OrderPaymentSummary } from "@/services/paymentService";
import { OrderShipmentData } from "@/services/deliveryService";

interface OrderDetailsCardProps {
  order: Order;
  paymentSummary?: OrderPaymentSummary | null;
  shipmentData?: OrderShipmentData | null;
  onPaymentUpdated?: () => void;
  onShipmentUpdated?: () => void;
}

const OrderDetailsCard = ({
  order,
  paymentSummary,
  shipmentData,
  onPaymentUpdated,
  onShipmentUpdated,
}: OrderDetailsCardProps) => {
  return (
    <Card className="mb-6 border-0 shadow-lg bg-card rounded-3xl overflow-visible">
      <CardHeader className="rounded-t-3xl overflow-hidden accent-gradient text-white">
        <OrderHeader 
          orderId={order.id} 
          date={order.date} 
          status={order.status}
          governorate={order.customerInfo.governorate}
        />
      </CardHeader>
      <CardContent className="bg-card rounded-b-3xl p-8">
        <div className="space-y-8">
          {/* Customer Info */}
          <div className="bg-muted rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 text-right">معلومات العميل</h3>
            <CustomerInfo customerInfo={order.customerInfo} />
          </div>

          {/* Order Items */}
          <div className="bg-muted rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 text-right">تفاصيل الطلب</h3>
            <OrderItems items={order.items} />
          </div>

          {shipmentData && (
            <OrderShipmentCard
              data={shipmentData}
              onUpdated={() => onShipmentUpdated?.()}
            />
          )}

          {paymentSummary && (
            <OrderPaymentCard
              order={order}
              summary={paymentSummary}
              onUpdated={() => onPaymentUpdated?.()}
            />
          )}

          {/* Order Total */}
          <OrderTotal
            total={order.total}
            selectedGovernorate={order.customerInfo.governorate}
            discountAmount={order.discountAmount}
            couponCode={order.couponCode}
            deliveryFee={order.deliveryFee ?? shipmentData?.deliveryFee}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderDetailsCard;
