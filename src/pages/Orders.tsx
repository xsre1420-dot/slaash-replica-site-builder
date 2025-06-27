
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import OrdersHeader from "@/components/orders/OrdersHeader";
import OrdersFilters from "@/components/orders/OrdersFilters";
import OrdersEmptyState from "@/components/orders/OrdersEmptyState";
import OrdersSimpleTable from "@/components/orders/OrdersSimpleTable";
import { useOrders } from "@/components/orders/useOrders";

const Orders = () => {
  const {
    filteredOrders,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    archiveOrder,
    updateOrderStatus,
    clearDateFilter,
  } = useOrders();

  return (
    <div className="min-h-screen bg-primary-custom rtl font-arabic">
      {/* Header */}
      <OrdersHeader />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        <Card className="mb-6 shadow-sm border border-secondary bg-primary-custom">
          <CardHeader className="border-b border-secondary pb-4">
            <CardTitle className="text-right text-xl text-primary-custom">الطلبات</CardTitle>
            <CardDescription className="text-right text-secondary-custom">
              عرض وإدارة طلبات العملاء مع كافة معلومات التوصيل
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
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
              <OrdersSimpleTable 
                orders={filteredOrders} 
                onArchiveOrder={archiveOrder}
                onUpdateStatus={updateOrderStatus}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Orders;
