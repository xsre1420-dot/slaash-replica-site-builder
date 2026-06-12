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
import { OrderPaymentSummary } from "@/services/paymentService";

interface OrderDetailsCardProps {
  order: Order;
  paymentSummary?: OrderPaymentSummary | null;
  onPaymentUpdated?: () => void;
}

const OrderDetailsCard = ({ order, paymentSummary, onPaymentUpdated }: OrderDetailsCardProps) => {
  return (
    <Card className="mb-6 border-0 shadow-lg bg-card rounded-3xl overflow-visible">
      <CardHeader 
        className="rounded-t-3xl overflow-hidden accent-gradient text-white"
        style={{ 
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <OrderHeader 
          orderId={order.id} 
          date={order.date} 
          status={order.status}
          governorate={order.customerInfo.governorate}
        />
      </CardHeader>
      <CardContent className="bg-card rounded-b-3xl p-8" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderDetailsCard;
