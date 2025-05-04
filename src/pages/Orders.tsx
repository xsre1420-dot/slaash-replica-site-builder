
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import OrdersHeader from "@/components/orders/OrdersHeader";
import OrdersFilters from "@/components/orders/OrdersFilters";
import OrdersEmptyState from "@/components/orders/OrdersEmptyState";
import OrdersTable from "@/components/orders/OrdersTable";
import { useOrders } from "@/components/orders/useOrders";

const Orders = () => {
  const {
    filteredOrders,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    archiveOrder,
    clearDateFilter,
  } = useOrders();

  return (
    <div className="min-h-screen bg-gray-50 rtl">
      {/* Header */}
      <OrdersHeader />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-right">الطلبات</CardTitle>
            <CardDescription className="text-right">
              عرض وإدارة طلبات العملاء
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrdersFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              clearDateFilter={clearDateFilter}
            />

            {filteredOrders.length === 0 ? (
              <OrdersEmptyState />
            ) : (
              <OrdersTable orders={filteredOrders} onArchiveOrder={archiveOrder} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Orders;
