
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Trash2 } from "lucide-react";
import { formatPriceInput, convertArabicToEnglish } from "@/utils/numberUtils";
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
      setSettings((prev: any) => ({
        ...prev,
        deliveryPrices: [...prev.deliveryPrices, ...newPrices]
      }));
    }
  };

  React.useEffect(() => {
    if (settings.deliveryPrices.length === 0) {
      const allPrices = governorates.map(gov => ({ governorate: gov, price: 0 }));
      setSettings((prev: any) => ({
        ...prev,
        deliveryPrices: allPrices
      }));
    } else {
      initializeDeliveryPrices();
    }
  }, []);

  const updateDeliveryPrice = (index: number, field: 'governorate' | 'price', value: string | number) => {
    setSettings((prev: any) => ({
      ...prev,
      deliveryPrices: prev.deliveryPrices.map((item: DeliveryPrice, i: number) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handlePriceChange = (index: number, inputValue: string) => {
    // Convert Arabic numerics to English and format
    const formattedValue = formatPriceInput(inputValue);
    
    // Remove commas before parsing
    const numericValue = parseFloat(formattedValue.replace(/,/g, '')) || 0;
    
    updateDeliveryPrice(index, 'price', numericValue);
  };

  const formatDisplayPrice = (price: number): string => {
    if (price === 0) return '';
    return price.toLocaleString('en-US');
  };

  return (
    <Card className="border-0 shadow-none rounded-2xl bg-gray-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" 
               style={{ background: 'linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))' }}>
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-right text-xl text-black">إعدادات التوصيل</CardTitle>
            <CardDescription className="text-right text-gray-600">
              تحكم في أسعار وخيارات التوصيل حسب المحافظة
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-center mb-6">
            <Label className="text-center text-black font-medium text-lg">أسعار التوصيل حسب المحافظة</Label>
          </div>

          {settings.deliveryPrices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              جاري تحميل المحافظات...
            </div>
          ) : (
            settings.deliveryPrices.map((delivery, index) => (
              <div key={index} className="p-6 bg-white rounded-2xl border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="space-y-2">
                    <Label className="text-right block text-black font-medium">المحافظة</Label>
                    <div className="w-full text-right rounded-2xl border border-gray-200 text-black p-3 bg-gray-50">
                      {delivery.governorate}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-right block text-black font-medium">سعر التوصيل (د.ع)</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">د.ع</span>
                      <Input
                        type="text"
                        value={formatDisplayPrice(delivery.price)}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        className="text-right rounded-2xl border-gray-200 text-black"
                        placeholder="أدخل السعر"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryTab;
