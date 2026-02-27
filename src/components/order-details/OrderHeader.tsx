
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import StatusChangeDropdown from "./StatusChangeDropdown";
import { useStore } from "@/context/StoreContext";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface OrderHeaderProps {
  orderId: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  governorate?: string;
}

const OrderHeader = ({ orderId, date, status: initialStatus, governorate }: OrderHeaderProps) => {
  const { storeGovernorate } = useStore();
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const { toast } = useToast();
  
  const handleStatusChange = async (orderId: string, newStatus: 'pending' | 'completed' | 'cancelled') => {
    try {
      // Get current orders from localStorage
      const storedOrders = localStorage.getItem('orders');
      if (storedOrders) {
        const orders = JSON.parse(storedOrders);
        const updatedOrders = orders.map((order: any) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        );
        localStorage.setItem('orders', JSON.stringify(updatedOrders));
        
        // Update local state for smooth transition
        setCurrentStatus(newStatus);
        
        // Show success message
        const statusMessages = {
          completed: "تم تحديث حالة الطلب إلى مكتمل",
          pending: "تم تحديث حالة الطلب إلى قيد الانتظار", 
          cancelled: "تم تحديث حالة الطلب إلى ملغي"
        };
        
        toast({
          title: statusMessages[newStatus],
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "حدث خطأ في تحديث حالة الطلب",
        variant: "destructive",
        duration: 2000
      });
    }
  };

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center text-white">
        <Calendar className="w-4 h-4 ml-2" />
        <span>{format(new Date(date), "yyyy-MM-dd hh:mm a")}</span>
      </div>
      <div>
        <CardTitle className="text-right flex items-center justify-end gap-3 text-white">
          تفاصيل الطلب
          <StatusChangeDropdown 
            currentStatus={currentStatus}
            orderId={orderId}
            onStatusChange={handleStatusChange}
          />
        </CardTitle>
        <CardDescription className="text-right text-primary-foreground/80 mt-2">
          {orderId}
        </CardDescription>
        {storeGovernorate && (
          <div className="text-right text-primary-foreground/80 mt-1 text-sm">
            محافظة المتجر: {storeGovernorate}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHeader;
