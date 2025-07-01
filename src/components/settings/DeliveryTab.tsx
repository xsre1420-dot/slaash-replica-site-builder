
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";

interface DeliveryTabProps {
  settings: {
    deliveryEnabled: boolean;
    deliveryPrice: number;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const DeliveryTab = ({ settings, setSettings }: DeliveryTabProps) => {
  return (
    <Card className="border-0 shadow-none rounded-2xl" style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #6366f1' }}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6366f1' }}>
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-right text-xl text-black">إعدادات التوصيل</CardTitle>
            <CardDescription className="text-right text-gray-600">
              تحكم في أسعار وخيارات التوصيل
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100">
          <Switch
            checked={settings.deliveryEnabled}
            onCheckedChange={(checked) => setSettings((prev: any) => ({ ...prev, deliveryEnabled: checked }))}
          />
          <div className="text-right">
            <h3 className="font-semibold text-black">تفعيل خدمة التوصيل</h3>
            <p className="text-sm text-gray-600">تمكين أو تعطيل خدمة التوصيل للعملاء</p>
          </div>
        </div>

        {settings.deliveryEnabled && (
          <div className="space-y-4">
            <div className="p-6 bg-white rounded-2xl border border-gray-100">
              <Label className="text-right block text-black font-medium mb-3">سعر التوصيل (د.ع)</Label>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">د.ع</span>
                <Input
                  type="number"
                  value={settings.deliveryPrice}
                  onChange={(e) => setSettings((prev: any) => ({ ...prev, deliveryPrice: parseInt(e.target.value) || 0 }))}
                  className="text-right rounded-2xl border-gray-200 text-black"
                  placeholder="2000"
                  min="0"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2 text-right">
                سيتم إضافة هذا المبلغ إلى إجمالي الطلب
              </p>
            </div>

            <div className="p-6 rounded-2xl" style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe' }}>
              <h4 className="font-semibold text-black text-right mb-2">معاينة سعر التوصيل</h4>
              <div className="flex justify-between items-center p-3 bg-white rounded-xl">
                <span className="font-bold text-black">{settings.deliveryPrice.toLocaleString()} د.ع</span>
                <span className="text-gray-700">رسوم التوصيل:</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeliveryTab;
