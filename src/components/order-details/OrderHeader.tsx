import { useEffect } from 'react';
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import StatusChangeDropdown from "./StatusChangeDropdown";
import { useStore } from "@/context/StoreContext";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { updateOrderStatus } from "@/services/orderService";

interface OrderHeaderProps {
  orderId: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  governorate?: string;
  onStatusUpdated?: (status: 'pending' | 'completed' | 'cancelled') => void;
}

const OrderHeader = ({ orderId, date, status: initialStatus, governorate, onStatusUpdated }: OrderHeaderProps) => {
  const { storeGovernorate } = useStore();
  const { user } = useAuth();
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentStatus(initialStatus);
  }, [initialStatus]);
  
  const handleStatusChange = async (orderId: string, newStatus: 'pending' | 'completed' | 'cancelled') => {
    try {
      if (!user?.id) throw new Error('Not authenticated');
      const result = await updateOrderStatus(orderId, user.id, newStatus);
      if (!result.success) throw new Error(result.error);

      setCurrentStatus(newStatus);
      onStatusUpdated?.(newStatus);
      
      const statusMessages = {
        completed: "تم تحديث حالة الطلب إلى مكتمل",
        pending: "تم تحديث حالة الطلب إلى قيد الانتظار", 
        cancelled: "تم تحديث حالة الطلب إلى ملغي"
      };
      
      toast({ title: statusMessages[newStatus], duration: 2000 });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({ title: "حدث خطأ في تحديث حالة الطلب", variant: "destructive", duration: 2000 });
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
