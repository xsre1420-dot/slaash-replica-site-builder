
import { CalendarRange } from "lucide-react";

const OrdersEmptyState = () => {
  return (
    <div className="text-center py-12 bg-white rounded-xl border mt-4">
      <div className="flex justify-center mb-4">
        <CalendarRange className="w-16 h-16 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد طلبات</h3>
      <p className="text-gray-500">لم يتم العثور على طلبات تطابق معايير البحث</p>
    </div>
  );
};

export default OrdersEmptyState;
