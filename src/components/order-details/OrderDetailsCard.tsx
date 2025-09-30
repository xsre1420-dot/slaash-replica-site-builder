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

interface OrderDetailsCardProps {
  order: Order;
}

const OrderDetailsCard = ({ order }: OrderDetailsCardProps) => {
  return (
    <Card className="mb-6 border-0 shadow-lg bg-white rounded-3xl overflow-visible">
      <CardHeader 
        className="rounded-t-3xl overflow-hidden bg-black text-white"
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
      <CardContent className="bg-white rounded-b-3xl p-8" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div className="space-y-8">
          {/* Customer Info */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-black mb-4 text-right">معلومات العميل</h3>
            <CustomerInfo customerInfo={order.customerInfo} />
          </div>

          {/* Order Items */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-black mb-4 text-right">تفاصيل الطلب</h3>
            <OrderItems items={order.items} />
          </div>

          {/* Order Total */}
          <OrderTotal total={order.total} selectedGovernorate={order.customerInfo.governorate} />
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderDetailsCard;