
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
    <div className="min-h-screen bg-gray-50 rtl font-arabic">
      {/* Modern Header */}
      <div className="bg-white shadow-sm">
        <OrdersHeader />
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 text-right mb-2">الطلبات</h1>
            <p className="text-gray-600 text-right">عرض وإدارة طلبات العملاء مع كافة معلومات التوصيل</p>
          </div>

          <div className="mb-8">
            <OrdersFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              clearDateFilter={clearDateFilter}
            />
          </div>

          {filteredOrders.length === 0 ? (
            <OrdersEmptyState />
          ) : (
            <div className="bg-gray-50 rounded-2xl p-6">
              <OrdersSimpleTable 
                orders={filteredOrders} 
                onArchiveOrder={archiveOrder}
                onUpdateStatus={updateOrderStatus}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Orders;
