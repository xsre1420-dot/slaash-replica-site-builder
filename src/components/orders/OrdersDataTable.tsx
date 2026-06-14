import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, Phone, MapPin, MoreHorizontal, CheckCircle, XCircle } from 'lucide-react';
import { Order } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import OrderStatusBadges from './OrderStatusBadges';
import { formatOrderNumber } from '@/utils/orderWorkflowUtils';
import { getPaymentMethodLabel } from '@/utils/paymentUtils';
import { cn } from '@/lib/utils';
import { canTransitionOrderStatus } from '@/utils/orderStatusUtils';

interface OrdersDataTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
}

const OrdersDataTable = ({ orders, onUpdateStatus }: OrdersDataTableProps) => {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block rounded-2xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-right font-bold">الطلب</TableHead>
              <TableHead className="text-right font-bold">العميل</TableHead>
              <TableHead className="text-right font-bold">الموقع</TableHead>
              <TableHead className="text-right font-bold">التاريخ</TableHead>
              <TableHead className="text-right font-bold">الحالة</TableHead>
              <TableHead className="text-right font-bold">القيمة</TableHead>
              <TableHead className="text-right font-bold w-[100px]">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.id}
                className={cn(
                  'group cursor-pointer hover:bg-muted/30',
                  order.status === 'cancelled' && 'opacity-60'
                )}
              >
                <TableCell className="align-top">
                  <Link to={`/orders/${order.id}`} className="block space-y-1">
                    <p className="font-bold text-foreground">{formatOrderNumber(order.id)}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]" dir="ltr">
                      {order.id.slice(0, 13)}…
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.items.length} منتج · {getPaymentMethodLabel(order.paymentMethod)}
                    </p>
                  </Link>
                </TableCell>
                <TableCell className="align-top">
                  <Link to={`/orders/${order.id}`} className="block space-y-1">
                    <p className="font-semibold text-foreground">{order.customerInfo.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end" dir="ltr">
                      <Phone className="w-3 h-3 shrink-0" />
                      {order.customerInfo.phone}
                    </p>
                  </Link>
                </TableCell>
                <TableCell className="align-top max-w-[180px]">
                  <div className="space-y-1 text-right">
                    {order.customerInfo.governorate && (
                      <p className="text-sm font-medium flex items-center gap-1 justify-end">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        {order.customerInfo.governorate}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2">{order.customerInfo.address}</p>
                  </div>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">
                  <p className="text-sm font-medium">{format(new Date(order.date), 'yyyy-MM-dd')}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(order.date), 'hh:mm a')}</p>
                </TableCell>
                <TableCell className="align-top">
                  <OrderStatusBadges order={order} compact />
                </TableCell>
                <TableCell className="align-top">
                  <p className="font-bold text-foreground">{order.total.toLocaleString()} د.ع</p>
                  {order.discountAmount ? (
                    <p className="text-xs text-primary">-{order.discountAmount.toLocaleString()} خصم</p>
                  ) : null}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="rounded-xl" asChild>
                      <Link to={`/orders/${order.id}`} aria-label="عرض الطلب">
                        <Eye className="w-4 h-4" />
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl" aria-label="إجراءات سريعة">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl min-w-[180px]">
                        <DropdownMenuItem asChild>
                          <Link to={`/orders/${order.id}`} className="cursor-pointer">عرض التفاصيل</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {canTransitionOrderStatus(order.status, 'completed') && (
                          <DropdownMenuItem onClick={() => onUpdateStatus(order.id, 'completed')} className="cursor-pointer gap-2">
                            <CheckCircle className="w-4 h-4 text-success" />
                            تأكيد / إكمال
                          </DropdownMenuItem>
                        )}
                        {canTransitionOrderStatus(order.status, 'cancelled') && (
                          <DropdownMenuItem onClick={() => onUpdateStatus(order.id, 'cancelled')} className="cursor-pointer gap-2 text-destructive">
                            <XCircle className="w-4 h-4" />
                            إلغاء الطلب
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="lg:hidden space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className={cn(
              'block rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all',
              order.status === 'cancelled' && 'opacity-60'
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="text-right min-w-0 flex-1">
                <p className="font-bold text-foreground">{formatOrderNumber(order.id)}</p>
                <p className="font-semibold mt-1 truncate">{order.customerInfo.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{order.customerInfo.phone}</p>
              </div>
              <div className="text-left shrink-0">
                <p className="font-bold text-lg text-foreground">{order.total.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">د.ع</p>
              </div>
            </div>

            <OrderStatusBadges order={order} compact className="mb-3" />

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
              <span>{format(new Date(order.date), 'yyyy-MM-dd · hh:mm a')}</span>
              {order.customerInfo.governorate && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {order.customerInfo.governorate}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
};

export default OrdersDataTable;
