
import { useStore } from "@/context/StoreContext";

interface OrderTotalProps {
  total: number;
  selectedGovernorate?: string;
  discountAmount?: number;
  couponCode?: string;
  deliveryFee?: number;
}

const OrderTotal = ({ total, selectedGovernorate, discountAmount = 0, couponCode, deliveryFee }: OrderTotalProps) => {
  const { storeSettings } = useStore();

  const deliveryPrice = deliveryFee ?? storeSettings.deliveryPrices?.find(
    (d) => d.governorate === selectedGovernorate
  )?.price ?? storeSettings.deliveryPrices?.[0]?.price ?? 0;

  const grandTotal = total;
  const productSubtotal = grandTotal - deliveryPrice + discountAmount;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mt-6">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-primary">المجموع الفرعي:</span>
          <span className="text-lg font-bold text-foreground">
            {productSubtotal.toLocaleString()} د.ع
          </span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-sm text-primary">
            <span>-{discountAmount.toLocaleString()} د.ع</span>
            <span>الخصم{couponCode ? ` (${couponCode})` : ''}</span>
          </div>
        )}

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
