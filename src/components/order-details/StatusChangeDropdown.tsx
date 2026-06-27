
import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllowedNextStatuses, canTransitionOrderStatus } from "@/utils/orderStatusUtils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StatusChangeDropdownProps {
  currentStatus: 'pending' | 'completed' | 'cancelled';
  orderId: string;
  onStatusChange: (orderId: string, newStatus: 'pending' | 'completed' | 'cancelled') => void;
}

const StatusChangeDropdown = ({ currentStatus, orderId, onStatusChange }: StatusChangeDropdownProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const allowedNext = getAllowedNextStatuses(currentStatus);

  const handleStatusChange = async (newStatus: 'pending' | 'completed' | 'cancelled') => {
    if (!canTransitionOrderStatus(currentStatus, newStatus)) {
      toast.error('لا يمكن تغيير حالة الطلب بهذه الطريقة');
      return;
    }
    setIsUpdating(true);
    await onStatusChange(orderId, newStatus);
    setIsUpdating(false);
  };

  const statusStyles = {
    completed: "bg-success text-success-foreground hover:bg-success/90 border-success/30",
    cancelled: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive/30",
    pending: "bg-warning text-warning-foreground hover:bg-warning/90 border-warning/30",
  };

  const statusLabels = {
    completed: "مكتمل",
    cancelled: "ملغي",
    pending: "قيد الانتظار",
  };

  const StatusIcon = currentStatus === 'completed' ? Check : currentStatus === 'cancelled' ? X : Loader2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isUpdating || allowedNext.length === 0}
          aria-label="تغيير حالة الطلب"
          className={cn(
            statusStyles[currentStatus],
            "transition-all duration-200 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border min-h-[44px]",
            (isUpdating || allowedNext.length === 0) && "opacity-70 cursor-default"
          )}
        >
          <StatusIcon className={cn("w-4 h-4", (currentStatus === 'pending' || isUpdating) && "animate-spin")} />
          {isUpdating ? 'جاري التحديث...' : statusLabels[currentStatus]}
        </button>
      </DropdownMenuTrigger>
      {allowedNext.length > 0 && (
        <DropdownMenuContent align="end" side="bottom" className="min-w-[140px]" sideOffset={5}>
          {allowedNext.includes('completed') && (
            <DropdownMenuItem
              onClick={() => handleStatusChange("completed")}
              className="cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-success" />
              <span>مكتمل</span>
            </DropdownMenuItem>
          )}
          {allowedNext.includes('cancelled') && (
            <DropdownMenuItem
              onClick={() => handleStatusChange("cancelled")}
              className="cursor-pointer flex items-center gap-2"
            >
              <X className="w-4 h-4 text-destructive" />
              <span>ملغي</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};

export default StatusChangeDropdown;
