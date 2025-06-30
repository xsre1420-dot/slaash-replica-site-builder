
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import StatusChangeDropdown from "./StatusChangeDropdown";

interface OrderHeaderProps {
  orderId: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}

const OrderHeader = ({ orderId, date, status }: OrderHeaderProps) => {
  const handleStatusChange = (orderId: string, newStatus: 'pending' | 'completed' | 'cancelled') => {
    // Get current orders from localStorage
    const storedOrders = localStorage.getItem('orders');
    if (storedOrders) {
      try {
        const orders = JSON.parse(storedOrders);
        const updatedOrders = orders.map((order: any) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        );
        localStorage.setItem('orders', JSON.stringify(updatedOrders));
        
        // Reload the page to reflect changes
        window.location.reload();
      } catch (error) {
        console.error('Error updating order status:', error);
      }
    }
  };

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center text-white">
        <Calendar className="w-5 h-5 ml-2" />
        <span>{format(new Date(date), "yyyy-MM-dd hh:mm a")}</span>
      </div>
      <div>
        <CardTitle className="text-right flex items-center justify-end gap-3 text-white">
          تفاصيل الطلب
          <StatusChangeDropdown 
            currentStatus={status}
            orderId={orderId}
            onStatusChange={handleStatusChange}
          />
        </CardTitle>
        <CardDescription className="text-right text-blue-100 mt-2">
          {orderId}
        </CardDescription>
      </div>
    </div>
  );
};

export default OrderHeader;
