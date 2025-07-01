
import { useStore } from "@/context/StoreContext";

interface OrderTotalProps {
  total: number;
}

const OrderTotal = ({ total }: OrderTotalProps) => {
  const { storeSettings } = useStore();
  const deliveryPrice = storeSettings.deliveryEnabled ? storeSettings.deliveryPrice : 0;
  const grandTotal = total + deliveryPrice;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-6 mt-6">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-blue-800">المجموع الفرعي:</span>
          <span className="text-lg font-bold text-blue-900">
            {total.toLocaleString()} د.ع
          </span>
        </div>
        
        {storeSettings.deliveryEnabled && (
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-blue-800">رسوم التوصيل:</span>
            <span className="text-lg font-bold text-blue-900">
              {deliveryPrice.toLocaleString()} د.ع
            </span>
          </div>
        )}
        
        <hr className="border-blue-200" />
        
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-blue-800">المجموع الكلي:</span>
          <span className="text-2xl font-bold text-blue-900">
            {grandTotal.toLocaleString()} د.ع
          </span>
        </div>
      </div>
    </div>
  );
};

export default OrderTotal;
