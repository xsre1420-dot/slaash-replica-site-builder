import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Eye,
  Phone,
  MapPin,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  ChevronLeft,
  MessageSquare,
  Package,
} from 'lucide-react';
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
import OrderWorkflowProgress from './OrderWorkflowProgress';
import { Checkbox } from '@/components/ui/checkbox';
import { formatOrderNumber, getOrderWorkflowCategory } from '@/utils/orderWorkflowUtils';
import { getPaymentMethodLabel } from '@/utils/paymentUtils';
import { cn } from '@/lib/utils';
import { canTransitionOrderStatus } from '@/utils/orderStatusUtils';

interface OrdersDataTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (orderId: string) => void;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
}

const workflowAccent: Record<string, string> = {
  new: 'bg-warning',
  processing: 'bg-primary',
  paid: 'bg-blue-500',
  shipped: 'bg-indigo-500',
  delivered: 'bg-success',
  cancelled: 'bg-destructive',
  refunded: 'bg-orange-500',
  all: 'bg-muted-foreground',
};

interface OrderMobileCardProps {
  order: Order;
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  selected?: boolean;
  onToggleSelect?: (orderId: string) => void;
}

const OrderMobileCard = ({ order, onUpdateStatus, selected, onToggleSelect }: OrderMobileCardProps) => {
  const workflow = getOrderWorkflowCategory(order);
  const accent = workflowAccent[workflow] ?? workflowAccent.all;
  const canComplete = canTransitionOrderStatus(order.status, 'completed');
  const canCancel = canTransitionOrderStatus(order.status, 'cancelled');
  const phoneDigits = order.customerInfo.phone.replace(/\D/g, '');

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm',
        order.status === 'cancelled' && 'opacity-65'
      )}
    >
      <span className={cn('absolute inset-y-0 right-0 w-1', accent)} aria-hidden="true" />

      <div className="flex items-start gap-2 p-4 pb-0">
        {onToggleSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(order.id)}
            className="mt-1 shrink-0"
            aria-label={`تحديد ${formatOrderNumber(order.id)}`}
          />
        )}
        <Link
          to={`/orders/${order.id}`}
          className="block flex-1 min-w-0 pb-3 active:bg-muted/30 transition-colors -m-2 p-2 rounded-xl"
        >
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="text-right min-w-0 flex-1 pr-1">
            <div className="flex items-center gap-2 justify-end">
              <p className="font-bold text-foreground text-sm">{formatOrderNumber(order.id)}</p>
              <ChevronLeft className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            </div>
            <p className="font-semibold mt-1 truncate text-base">{order.customerInfo.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-end" dir="ltr">
              <Phone className="w-3 h-3 shrink-0" />
              {order.customerInfo.phone}
            </p>
          </div>
          <div className="text-left shrink-0">
            <p className="font-bold text-lg text-foreground tabular-nums">
              {order.total.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">د.ع</p>
          </div>
        </div>

        <OrderStatusBadges order={order} compact className="mb-2 justify-end" />
        <OrderWorkflowProgress order={order} compact className="mb-2" />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground justify-end">
          <span>{format(new Date(order.date), 'yyyy-MM-dd · hh:mm a')}</span>
          <span className="inline-flex items-center gap-1">
            <Package className="w-3 h-3" />
            {order.items.length} منتج
          </span>
          {order.customerInfo.governorate && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {order.customerInfo.governorate}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
          {getPaymentMethodLabel(order.paymentMethod)}
        </p>
        </Link>
      </div>

      <div className="flex items-center gap-2 px-3 pb-3 pt-0 border-t border-border/40 mx-3 pt-3">
        {phoneDigits && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl h-10 w-10 shrink-0 border-border/60"
              asChild
            >
              <a href={`tel:${phoneDigits}`} aria-label="اتصال">
                <Phone className="w-4 h-4" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl h-10 w-10 shrink-0 border-border/60"
              asChild
            >
              <a
                href={`https://wa.me/${phoneDigits}`}
                target="_blank"
                rel="noreferrer"
                aria-label="واتساب"
              >
                <MessageSquare className="w-4 h-4" />
              </a>
            </Button>
          </>
        )}

        <div className="flex-1 flex gap-2 justify-end min-w-0">
          {canComplete && (
            <Button
              size="sm"
              className="rounded-xl h-10 flex-1 max-w-[120px] gap-1 bg-success hover:bg-success/90 text-success-foreground"
              onClick={() => onUpdateStatus(order.id, 'completed')}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">تأكيد</span>
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl h-10 flex-1 max-w-[100px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => onUpdateStatus(order.id, 'cancelled')}
            >
              <XCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">إلغاء</span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-xl h-10 gap-1 shrink-0" asChild>
            <Link to={`/orders/${order.id}`}>
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">عرض</span>
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

const OrdersDataTable = ({
  orders,
  onUpdateStatus,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
}: OrdersDataTableProps) => {
  const hasSelection = !!onToggleSelect;

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm min-w-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {hasSelection && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => onToggleSelectAll?.()}
                    aria-label="تحديد الكل"
                  />
                </TableHead>
              )}
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
                  'group hover:bg-muted/30',
                  order.status === 'cancelled' && 'opacity-60',
                  selectedIds?.has(order.id) && 'bg-primary/5'
                )}
              >
                {hasSelection && (
                  <TableCell className="align-top">
                    <Checkbox
                      checked={selectedIds?.has(order.id)}
                      onCheckedChange={() => onToggleSelect?.(order.id)}
                      aria-label={`تحديد ${formatOrderNumber(order.id)}`}
                    />
                  </TableCell>
                )}
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
                  <OrderWorkflowProgress order={order} compact className="mt-2 max-w-[200px]" />
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
                          <Link to={`/orders/${order.id}`} className="cursor-pointer">
                            عرض التفاصيل
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {canTransitionOrderStatus(order.status, 'completed') && (
                          <DropdownMenuItem
                            onClick={() => onUpdateStatus(order.id, 'completed')}
                            className="cursor-pointer gap-2"
                          >
                            <CheckCircle className="w-4 h-4 text-success" />
                            تأكيد / إكمال
                          </DropdownMenuItem>
                        )}
                        {canTransitionOrderStatus(order.status, 'cancelled') && (
                          <DropdownMenuItem
                            onClick={() => onUpdateStatus(order.id, 'cancelled')}
                            className="cursor-pointer gap-2 text-destructive"
                          >
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

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3 min-w-0">
        {orders.map((order) => (
          <OrderMobileCard
            key={order.id}
            order={order}
            onUpdateStatus={onUpdateStatus}
            selected={selectedIds?.has(order.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </>
  );
};

export default OrdersDataTable;
