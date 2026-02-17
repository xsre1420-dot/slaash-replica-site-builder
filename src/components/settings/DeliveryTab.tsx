import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";
import { formatPriceInput } from "@/utils/numberUtils";
import React from "react";

interface DeliveryPrice {
  governorate: string;
  price: number;
}

interface DeliveryTabProps {
  settings: {
    deliveryPrices: DeliveryPrice[];
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const governorates = [
  "بغداد", "نينوى (الموصل)", "البصرة", "الأنبار", "ذي قار (الناصرية)",
  "السليمانية", "أربيل", "دهوك", "كركوك", "ديالى", "صلاح الدين",
  "واسط (الكوت)", "بابل (الحلة)", "النجف", "كربلاء", "المثنى (السماوة)",
  "ميسان (العمارة)", "القادسية (الديوانية)"
];

const DeliveryTab = ({ settings, setSettings }: DeliveryTabProps) => {
  const initializeDeliveryPrices = () => {
    const existingGovernorates = settings.deliveryPrices.map((d: DeliveryPrice) => d.governorate);
    const missingGovernorates = governorates.filter(gov => !existingGovernorates.includes(gov));
    if (missingGovernorates.length > 0) {
      const newPrices = missingGovernorates.map(gov => ({ governorate: gov, price: 0 }));
      setSettings((prev: any) => ({ ...prev, deliveryPrices: [...prev.deliveryPrices, ...newPrices] }));
    }
  };

  React.useEffect(() => {
    if (settings.deliveryPrices.length === 0) {
      setSettings((prev: any) => ({ ...prev, deliveryPrices: governorates.map(gov => ({ governorate: gov, price: 0 })) }));
    } else {
      initializeDeliveryPrices();
    }
  }, []);

  const handlePriceChange = (index: number, inputValue: string) => {
    const formattedValue = formatPriceInput(inputValue);
    const numericValue = parseFloat(formattedValue.replace(/,/g, '')) || 0;
    setSettings((prev: any) => ({
      ...prev,
      deliveryPrices: prev.deliveryPrices.map((item: DeliveryPrice, i: number) =>
        i === index ? { ...item, price: numericValue } : item
      )
    }));
  };

  const formatDisplayPrice = (price: number): string => {
    if (price === 0) return '';
    return price.toLocaleString('en-US');
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 justify-end">
        <h3 className="text-lg font-bold text-foreground">أسعار التوصيل</h3>
        <Truck className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground text-right">حدد سعر التوصيل لكل محافظة</p>

      <div className="space-y-2">
        {settings.deliveryPrices.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">جاري تحميل المحافظات...</div>
        ) : (
          settings.deliveryPrices.map((delivery, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border">
              <div className="flex items-center gap-2 w-36 sm:w-44">
                <span className="text-xs text-muted-foreground">د.ع</span>
                <Input
                  type="text"
                  value={formatDisplayPrice(delivery.price)}
                  onChange={(e) => handlePriceChange(index, e.target.value)}
                  className="text-right rounded-lg border-border h-9 text-sm"
                  placeholder="0"
                />
              </div>
              <span className="flex-1 text-right text-sm font-medium text-foreground">{delivery.governorate}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DeliveryTab;
