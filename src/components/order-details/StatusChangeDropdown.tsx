
import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface StatusChangeDropdownProps {
  currentStatus: 'pending' | 'completed' | 'cancelled';
  orderId: string;
  onStatusChange: (orderId: string, newStatus: 'pending' | 'completed' | 'cancelled') => void;
}

const StatusChangeDropdown = ({ currentStatus, orderId, onStatusChange }: StatusChangeDropdownProps) => {
  const { toast } = useToast();

  const handleStatusChange = (newStatus: 'pending' | 'completed' | 'cancelled') => {
    onStatusChange(orderId, newStatus);
    
    const statusMessages = {
      completed: "تم تحديث حالة الطلب إلى مكتمل",
      pending: "تم تحديث حالة الطلب إلى قيد الانتظار",
      cancelled: "تم تحديث حالة الطلب إلى ملغي"
    };
    
    toast({
      title: statusMessages[newStatus],
      duration: 2000
    });
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          label: "مكتمل",
          icon: Check,
          className: "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200"
        };
      case 'cancelled':
        return {
          label: "ملغي",
          icon: X,
          className: "bg-red-100 text-red-800 hover:bg-red-200 border border-red-200"
        };
      case 'pending':
      default:
        return {
          label: "قيد الانتظار",
          icon: Loader2,
          className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200"
        };
    }
  };

  const statusDisplay = getStatusDisplay(currentStatus);
  const Icon = statusDisplay.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge className={`${statusDisplay.className} cursor-pointer transition-all duration-200 flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full hover:shadow-md`}>
          <Icon className={`h-4 w-4 ${currentStatus === 'pending' ? 'animate-spin' : ''}`} />
          {statusDisplay.label}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white shadow-xl border border-blue-200 rounded-2xl z-50 p-2">
        <DropdownMenuItem 
          onClick={() => handleStatusChange("completed")}
          className="cursor-pointer hover:bg-green-50 rounded-xl p-3 transition-colors duration-200"
        >
          <Check className="h-5 w-5 ml-3 text-green-600" />
          <span className="font-medium">مكتمل</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleStatusChange("pending")}
          className="cursor-pointer hover:bg-yellow-50 rounded-xl p-3 transition-colors duration-200"
        >
          <Loader2 className="h-5 w-5 ml-3 text-yellow-600" />
          <span className="font-medium">قيد الانتظار</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleStatusChange("cancelled")}
          className="cursor-pointer hover:bg-red-50 rounded-xl p-3 transition-colors duration-200"
        >
          <X className="h-5 w-5 ml-3 text-red-600" />
          <span className="font-medium">ملغي</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StatusChangeDropdown;
