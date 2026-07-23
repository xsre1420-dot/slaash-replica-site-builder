import { useState } from 'react';
import { Eye, Package, User } from 'lucide-react';
import { format } from 'date-fns';
import { Order } from '@/types';
import { Button } from '@/components/ui/button';
import OptimizedImage from '@/components/OptimizedImage';
import OrderDetailSheet from './OrderDetailSheet';
import {
  formatOrderDateTime,
  formatOrderNumber,
  getSimplifiedOrderDisplayStatus,
} from '@/utils/orderWorkflowUtils';
import { cn } from '@/lib/utils';

const statusBadgeClass: Record<string, string> = {
  new: 'bg-warning/15 text-warning border-warning/30',
  completed: 'bg-success/15 text-success border-success/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const formatOrderDateCompact = (value?: string): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return format(date, 'dd/MM · HH:mm');
  } catch {
    return formatOrderDateTime(value);
  }
};

interface OrdersDataTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
}

const cellPad = 'px-3 py-2.5 align-middle';

const OrdersDataTable = ({ orders, onUpdateStatus }: OrdersDataTableProps) => {
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openDetails = (order: Order) => {
    setDetailOrder(order);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setDetailOrder(null);
  };

  const activeOrder =
    detailOrder && orders.find((o) => o.id === detailOrder.id)
      ? orders.find((o) => o.id === detailOrder.id)!
      : detailOrder;

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card min-w-0 overflow-hidden">
        {/* Mobile — labeled fields aligned under their headings */}
        <div className="sm:hidden divide-y divide-border/30" dir="rtl">
          {orders.map((order) => {
            const customer = order.customerInfo ?? { name: '', phone: '', address: '' };
            const items = order.items ?? [];
            const total = Number(order.total) || 0;
            const firstItem = items[0];
            const previewImage = firstItem?.product?.image || null;
            const previewName = firstItem?.product?.name || 'طلب بدون منتجات';
            const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const { label: statusLabel, key: statusKey } = getSimplifiedOrderDisplayStatus(order);
            const dateLabel = formatOrderDateCompact(order.date);

            return (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                className={cn(
                  'px-3 py-3 space-y-3 hover:bg-muted/20 transition-colors cursor-pointer',
                  order.status === 'cancelled' && 'opacity-80'
                )}
                onClick={() => openDetails(order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetails(order);
                  }
                }}
              >
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">الطلب</p>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-10 w-10 rounded-lg shrink-0 overflow-hidden border border-border/40 bg-muted/40">
                      {previewImage ? (
                        <OptimizedImage
                          src={previewImage}
                          alt={previewName}
                          variant="thumbnail"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 text-right flex-1">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {formatOrderNumber(order.id)}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{previewName}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">العميل</p>
                    <p className="text-sm text-foreground truncate flex items-center gap-1 justify-end">
                      <span className="truncate">{customer.name || '—'}</span>
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">الحالة</p>
                    <span
                      className={cn(
                        'inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md border',
                        statusBadgeClass[statusKey]
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">التاريخ</p>
                    <p className="text-sm text-muted-foreground tabular-nums">{dateLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">الإجمالي</p>
                    <p className="text-sm font-semibold tabular-nums">{total.toLocaleString()} د.ع</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">المنتجات</p>
                    <p className="text-sm text-muted-foreground tabular-nums inline-flex items-center gap-1">
                      {itemCount}
                      <Package className="h-3.5 w-3.5 opacity-60" />
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop — fixed columns so each value sits under its header */}
        <table className="hidden sm:table w-full table-fixed text-sm" dir="rtl">
          <colgroup>
            <col className="w-[27%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground text-[11px] font-medium">
              <th className={cn(cellPad, 'text-right font-medium')}>الطلب</th>
              <th className={cn(cellPad, 'text-right font-medium')}>العميل</th>
              <th className={cn(cellPad, 'text-right font-medium')}>الحالة</th>
              <th className={cn(cellPad, 'text-right font-medium')}>التاريخ</th>
              <th className={cn(cellPad, 'text-right font-medium')}>الإجمالي</th>
              <th className={cn(cellPad, 'text-right font-medium')}>المنتجات</th>
              <th className={cn(cellPad, 'text-center font-medium')}>إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {orders.map((order) => {
              const customer = order.customerInfo ?? { name: '', phone: '', address: '' };
              const items = order.items ?? [];
              const total = Number(order.total) || 0;
              const firstItem = items[0];
              const previewImage = firstItem?.product?.image || null;
              const previewName = firstItem?.product?.name || 'طلب بدون منتجات';
              const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
              const { label: statusLabel, key: statusKey } = getSimplifiedOrderDisplayStatus(order);
              const dateLabel = formatOrderDateCompact(order.date);

              return (
                <tr
                  key={order.id}
                  className={cn(
                    'hover:bg-muted/20 transition-colors cursor-pointer group',
                    order.status === 'cancelled' && 'opacity-80'
                  )}
                  onClick={() => openDetails(order)}
                >
                  <td className={cellPad}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-lg shrink-0 overflow-hidden border border-border/40 bg-muted/40">
                        {previewImage ? (
                          <OptimizedImage
                            src={previewImage}
                            alt={previewName}
                            variant="thumbnail"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="font-semibold text-foreground truncate leading-tight">
                          {formatOrderNumber(order.id)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {previewName}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className={cn(cellPad, 'text-right')}>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground max-w-full justify-end">
                      <span className="truncate">{customer.name || '—'}</span>
                      <User className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    </span>
                  </td>

                  <td className={cn(cellPad, 'text-right')}>
                    <span
                      className={cn(
                        'inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap',
                        statusBadgeClass[statusKey]
                      )}
                    >
                      {statusLabel}
                    </span>
                  </td>

                  <td className={cn(cellPad, 'text-right text-muted-foreground text-[12px] tabular-nums')}>
                    {dateLabel}
                  </td>

                  <td className={cn(cellPad, 'text-right font-semibold tabular-nums whitespace-nowrap')}>
                    {total.toLocaleString()} د.ع
                  </td>

                  <td className={cn(cellPad, 'text-right')}>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
                      {itemCount}
                      <Package className="h-3.5 w-3.5 opacity-60" />
                    </span>
                  </td>

                  <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg opacity-70 group-hover:opacity-100"
                        onClick={() => openDetails(order)}
                        aria-label={`تفاصيل ${formatOrderNumber(order.id)}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OrderDetailSheet
        order={activeOrder}
        open={sheetOpen && !!activeOrder}
        onOpenChange={handleSheetOpenChange}
        onUpdateStatus={onUpdateStatus}
      />
    </>
  );
};

export default OrdersDataTable;
