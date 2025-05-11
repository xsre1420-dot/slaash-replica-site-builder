
import { Check, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: 'pending' | 'completed' | 'cancelled';
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1">
          <Check className="h-3 w-3" />
          مكتمل
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1">
          <X className="h-3 w-3" />
          ملغي
        </Badge>
      );
    default:
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          قيد الانتظار
        </Badge>
      );
  }
};

export default StatusBadge;
