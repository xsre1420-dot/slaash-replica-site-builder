
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Trash2 } from "lucide-react";

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

const DeliveryTab = ({ settings, setSettings }: DeliveryTabProps) => {
  const addDeliveryPrice = () => {
    setSettings((prev: any) => ({
      ...prev,
      deliveryPrices: [...prev.deliveryPrices, { governorate: "", price: 0 }]
    }));
  };

  const removeDeliveryPrice = (index: number) => {
    setSettings((prev: any) => ({
      ...prev,
      deliveryPrices: prev.deliveryPrices.filter((_: any, i: number) => i !== index)
    }));
  };

  const updateDeliveryPrice = (index: number, field: 'governorate' | 'price', value: string | number) => {
    setSettings((prev: any) => ({
      ...prev,
      deliveryPrices: prev.deliveryPrices.map((item: DeliveryPrice, i: number) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  return (
    <Card className="border-0 shadow-none rounded-2xl bg-gray-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6366f1' }}>
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
          <div className="flex items-center justify-between">
            <Button
              onClick={addDeliveryPrice}
              className="flex items-center gap-2 text-white rounded-2xl"
              style={{ backgroundColor: '#6366f1' }}
            >
              <Plus className="w-4 h-4" />
              إضافة محافظة جديدة
            </Button>
            <Label className="text-right text-black font-medium text-lg">أسعار التوصيل حسب المحافظة</Label>
          </div>

          {settings.deliveryPrices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              لا توجد محافظات مضافة. اضغط على "إضافة محافظة جديدة" للبدء.
            </div>
          ) : (
            settings.deliveryPrices.map((delivery, index) => (
              <div key={index} className="p-6 bg-white rounded-2xl border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label className="text-right block text-black font-medium">المحافظة</Label>
                    <Input
                      value={delivery.governorate}
                      onChange={(e) => updateDeliveryPrice(index, 'governorate', e.target.value)}
                      className="text-right rounded-2xl border-gray-200 text-black"
                      placeholder="اسم المحافظة"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-right block text-black font-medium">سعر التوصيل (د.ع)</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">د.ع</span>
                      <Input
                        type="number"
                        value={delivery.price}
                        onChange={(e) => updateDeliveryPrice(index, 'price', parseInt(e.target.value) || 0)}
                        className="text-right rounded-2xl border-gray-200 text-black"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <Button
                      onClick={() => removeDeliveryPrice(index)}
                      variant="outline"
                      size="icon"
                      className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
