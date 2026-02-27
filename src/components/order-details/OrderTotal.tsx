
import { useStore } from "@/context/StoreContext";

interface OrderTotalProps {
  total: number;
  selectedGovernorate?: string;
}

const OrderTotal = ({ total, selectedGovernorate }: OrderTotalProps) => {
  const { storeSettings } = useStore();
  
  // Find delivery price for selected governorate or default to first one
  const deliveryPrice = storeSettings.deliveryPrices?.find(
    d => d.governorate === selectedGovernorate
  )?.price || storeSettings.deliveryPrices?.[0]?.price || 0;
  
  // The total passed in already includes delivery, so subtract it for subtotal
  const productSubtotal = total - deliveryPrice;
  const grandTotal = total;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mt-6">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-primary">المجموع الفرعي:</span>
          <span className="text-lg font-bold text-foreground">
            {productSubtotal.toLocaleString()} د.ع
          </span>
        </div>
        
        {storeSettings.deliveryPrices && storeSettings.deliveryPrices.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-primary">رسوم التوصيل:</span>
              <span className="text-lg font-bold text-foreground">
                {deliveryPrice.toLocaleString()} د.ع
              </span>
            </div>
            {selectedGovernorate && (
              <div className="text-sm text-muted-foreground text-right">
                التوصيل إلى: {selectedGovernorate}
              </div>
            )}
          </div>
        )}
        
        <hr className="border-primary/20" />
        
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-primary">المجموع الكلي:</span>
          <span className="text-2xl font-bold text-foreground">
            {grandTotal.toLocaleString()} د.ع
          </span>
        </div>
      </div>
    </div>
  );
};

export default OrderTotal;
