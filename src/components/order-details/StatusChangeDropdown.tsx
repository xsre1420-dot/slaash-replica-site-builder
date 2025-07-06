
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
  const [isUpdating, setIsUpdating] = useState(false);
  
  const handleStatusChange = async (newStatus: 'pending' | 'completed' | 'cancelled') => {
    setIsUpdating(true);
    await onStatusChange(orderId, newStatus);
    setIsUpdating(false);
  };

  const handleDropdownClick = () => {
    console.log('Dropdown clicked');
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          label: "مكتمل",
          icon: Check,
          className: "bg-green-500 text-white hover:bg-green-600 cursor-pointer border-green-500"
        };
      case 'cancelled':
        return {
          label: "ملغي",
          icon: X,
          className: "bg-red-500 text-white hover:bg-red-600 cursor-pointer border-red-500"
        };
      case 'pending':
      default:
        return {
          label: "قيد الانتظار",
          icon: Loader2,
          className: "bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer border-yellow-500"
        };
    }
  };

  const statusDisplay = getStatusDisplay(currentStatus);
  const Icon = statusDisplay.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          onClick={handleDropdownClick}
          disabled={isUpdating}
          className={`${statusDisplay.className} ${isUpdating ? 'opacity-70' : ''} transition-all duration-300 ease-in-out flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 active:scale-95`}
        >
          <Icon className={`w-4 h-4 ${currentStatus === 'pending' || isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? 'جاري التحديث...' : statusDisplay.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        side="bottom"
        className="bg-white shadow-lg border rounded-lg z-[9999] min-w-[120px]"
        sideOffset={5}
      >
        <DropdownMenuItem 
          onClick={() => handleStatusChange("completed")}
          className="cursor-pointer hover:bg-green-50 flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-green-600" />
          <span>مكتمل</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleStatusChange("pending")}
          className="cursor-pointer hover:bg-yellow-50 flex items-center gap-2"
        >
          <Loader2 className="w-4 h-4 text-yellow-600" />
          <span>قيد الانتظار</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleStatusChange("cancelled")}
          className="cursor-pointer hover:bg-red-50 flex items-center gap-2"
        >
          <X className="w-4 h-4 text-red-600" />
          <span>ملغي</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StatusChangeDropdown;
