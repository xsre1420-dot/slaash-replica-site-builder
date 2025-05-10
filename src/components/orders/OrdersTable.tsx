
import { Order } from "@/types";
import { Link } from "react-router-dom";
import { Eye, Archive, Check, X } from "lucide-react";
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

interface OrdersTableProps {
  orders: Order[];
  onArchiveOrder: (orderId: string) => void;
}

const OrdersTable = ({ orders, onArchiveOrder }: OrdersTableProps) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">رقم الطلب</TableHead>
            <TableHead className="text-right">اسم العميل</TableHead>
            <TableHead className="text-right">رقم الهاتف</TableHead>
            <TableHead className="text-right">العنوان</TableHead>
            <TableHead className="text-right">التاريخ</TableHead>
            <TableHead className="text-right">المبلغ</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className={order.status === "cancelled" ? "opacity-50" : ""}>
              <TableCell className="font-medium">{order.id}</TableCell>
              <TableCell>{order.customerInfo.name}</TableCell>
              <TableCell>{order.customerInfo.phone}</TableCell>
              <TableCell>{order.customerInfo.address}</TableCell>
              <TableCell>{format(new Date(order.date), "yyyy-MM-dd HH:mm")}</TableCell>
              <TableCell>{order.total.toLocaleString()} د.ع</TableCell>
              <TableCell>
                {order.status === "completed" ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    مكتمل
                  </Badge>
                ) : order.status === "cancelled" ? (
                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    ملغي
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    قيد الانتظار
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => onArchiveOrder(order.id)}
                    disabled={order.status === "cancelled"}
                  >
                    <Archive className="h-4 w-4" />
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

export default OrdersTable;
