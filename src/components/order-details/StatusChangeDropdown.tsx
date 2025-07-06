
import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StatusChangeDropdownProps {
  currentStatus: 'pending' | 'completed' | 'cancelled';
  orderId: string;
  onStatusChange: (orderId: string, newStatus: 'pending' | 'completed' | 'cancelled') => void;
}

const StatusChangeDropdown = ({ currentStatus, orderId, onStatusChange }: StatusChangeDropdownProps) => {
  const handleStatusChange = (newStatus: 'pending' | 'completed' | 'cancelled') => {
    onStatusChange(orderId, newStatus);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          label: "مكتمل",
          icon: Check,
          className: "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
        };
      case 'cancelled':
        return {
          label: "ملغي",
          icon: X,
          className: "bg-red-500 text-white hover:bg-red-600 cursor-pointer"
        };
      case 'pending':
      default:
        return {
          label: "قيد الانتظار",
          icon: Loader2,
          className: "bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer"
        };
    }
  };

  const statusDisplay = getStatusDisplay(currentStatus);
  const Icon = statusDisplay.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge className={`${statusDisplay.className} transition-colors flex items-center gap-1 px-3 py-1`}>
          <Icon className={`h-3 w-3 ${currentStatus === 'pending' ? 'animate-spin' : ''}`} />
          {statusDisplay.label}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white shadow-lg border rounded-lg z-50">
        <DropdownMenuItem 
          onClick={() => handleStatusChange("completed")}
          className="cursor-pointer hover:bg-green-50 flex items-center gap-2"
        >
          <Check className="h-4 w-4 text-green-600" />
          <span>مكتمل</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleStatusChange("pending")}
          className="cursor-pointer hover:bg-yellow-50 flex items-center gap-2"
        >
          <Loader2 className="h-4 w-4 text-yellow-600" />
          <span>قيد الانتظار</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleStatusChange("cancelled")}
          className="cursor-pointer hover:bg-red-50 flex items-center gap-2"
        >
          <X className="h-4 w-4 text-red-600" />
          <span>ملغي</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StatusChangeDropdown;
