import { Order } from '@/types';
import OrderMobileCard from './OrderMobileCard';

interface OrdersDataTableProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (orderId: string) => void;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
}

const OrdersDataTable = ({
  orders,
  onUpdateStatus,
  selectedIds,
  onToggleSelect,
}: OrdersDataTableProps) => {
  return (
    <div className="space-y-3 min-w-0 xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0">
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
  );
};

export default OrdersDataTable;
