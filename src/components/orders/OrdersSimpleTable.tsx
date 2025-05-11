
import { Order } from "@/types";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface OrdersSimpleTableProps {
  orders: Order[];
  onArchiveOrder: (orderId: string) => void;
  onUpdateStatus: (orderId: string, status: "pending" | "completed" | "cancelled") => void;
}

const OrdersSimpleTable = ({ orders, onUpdateStatus }: OrdersSimpleTableProps) => {
  const { toast } = useToast();
  
  const handleStatusChange = (orderId: string, newStatus: "pending" | "completed" | "cancelled") => {
    onUpdateStatus(orderId, newStatus);
    
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

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-100">
            <TableHead className="text-right font-bold text-gray-800 py-4 border-b-2 border-gray-200">التاريخ</TableHead>
            <TableHead className="text-right font-bold text-gray-800 py-4 border-b-2 border-gray-200">المبلغ</TableHead>
            <TableHead className="text-right font-bold text-gray-800 py-4 border-b-2 border-gray-200">الحالة</TableHead>
            <TableHead className="text-right font-bold text-gray-800 py-4 border-b-2 border-gray-200">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className={order.status === "cancelled" ? "opacity-50 hover:bg-gray-50" : "hover:bg-gray-50"}>
              <TableCell className="py-3 text-right">
                {format(new Date(order.date), "yyyy-MM-dd HH:mm")}
              </TableCell>
              <TableCell className="py-3 text-right font-medium">{order.total.toLocaleString()} د.ع</TableCell>
              <TableCell className="py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 p-0">
                      {order.status === "completed" ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1 cursor-pointer">
                          <Check className="h-3 w-3" />
                          مكتمل
                        </Badge>
                      ) : order.status === "cancelled" ? (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1 cursor-pointer">
                          <X className="h-3 w-3" />
                          ملغي
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1 cursor-pointer">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          قيد الانتظار
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleStatusChange(order.id, "completed")}>
                      <Check className="h-4 w-4 mr-2" />
                      <span>مكتمل</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(order.id, "pending")}>
                      <Loader2 className="h-4 w-4 mr-2" />
                      <span>قيد الانتظار</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(order.id, "cancelled")}>
                      <X className="h-4 w-4 mr-2" />
                      <span>ملغي</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
              <TableCell className="py-3 text-right">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    asChild
                  >
                    <Link to={`/orders/${order.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default OrdersSimpleTable;
