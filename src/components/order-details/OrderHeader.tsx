
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import StatusBadge from "./StatusBadge";

interface OrderHeaderProps {
  orderId: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}

const OrderHeader = ({ orderId, date, status }: OrderHeaderProps) => {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center text-white">
        <Calendar className="w-5 h-5 ml-2" />
        <span>{format(new Date(date), "yyyy-MM-dd hh:mm a")}</span>
      </div>
      <div>
        <CardTitle className="text-right flex items-center justify-end gap-2 text-white">
          تفاصيل الطلب
          <StatusBadge status={status} />
        </CardTitle>
        <CardDescription className="text-right text-blue-100">
          {orderId}
        </CardDescription>
      </div>
    </div>
  );
};

export default OrderHeader;
