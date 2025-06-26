
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import OrdersFilters from "@/components/orders/OrdersFilters";
import OrdersEmptyState from "@/components/orders/OrdersEmptyState";
import OrdersSimpleTable from "@/components/orders/OrdersSimpleTable";
import { useOrders } from "@/components/orders/useOrders";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

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
    <div className="min-h-screen bg-white rtl">
      {/* Header with turquoise border */}
      <div className="bg-white text-black p-4 border-b-2 border-primary">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <ArrowLeft className="w-6 h-6 text-black" />
            </Link>
            <h1 className="text-xl font-bold text-black">إدارة الطلبات</h1>
            <div className="w-6"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        <Card className="mb-6 shadow-lg border-2 border-primary bg-white">
          <CardHeader className="border-b-2 border-primary pb-4">
            <CardTitle className="text-right text-xl text-black">الطلبات</CardTitle>
            <CardDescription className="text-right text-gray-600">
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
