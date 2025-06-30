
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
        <Badge className={`${statusDisplay.className} cursor-pointer transition-colors flex items-center gap-1`}>
          <Icon className={`h-3 w-3 ${currentStatus === 'pending' ? 'animate-spin' : ''}`} />
          {statusDisplay.label}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white shadow-xl border rounded-lg z-50 border-blue-100">
        {/* Show options based on current status */}
        {currentStatus === 'pending' && (
          <>
            <DropdownMenuItem 
              onClick={() => handleStatusChange("completed")}
              className="cursor-pointer hover:bg-green-50"
            >
              <Check className="h-4 w-4 ml-2 text-green-600" />
              <span>مكتمل</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleStatusChange("cancelled")}
              className="cursor-pointer hover:bg-red-50"
            >
              <X className="h-4 w-4 ml-2 text-red-600" />
              <span>ملغي</span>
            </DropdownMenuItem>
          </>
        )}
        
        {currentStatus !== 'pending' && (
          <DropdownMenuItem 
            onClick={() => handleStatusChange("pending")}
            className="cursor-pointer hover:bg-yellow-50"
          >
            <Loader2 className="h-4 w-4 ml-2 text-yellow-600" />
            <span>قيد الانتظار</span>
          </DropdownMenuItem>
        )}
        
        {currentStatus === 'cancelled' && (
          <DropdownMenuItem 
            onClick={() => handleStatusChange("completed")}
            className="cursor-pointer hover:bg-green-50"
          >
            <Check className="h-4 w-4 ml-2 text-green-600" />
            <span>مكتمل</span>
          </DropdownMenuItem>
        )}
        
        {currentStatus === 'completed' && (
          <DropdownMenuItem 
            onClick={() => handleStatusChange("cancelled")}
            className="cursor-pointer hover:bg-red-50"
          >
            <X className="h-4 w-4 ml-2 text-red-600" />
            <span>ملغي</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StatusChangeDropdown;
