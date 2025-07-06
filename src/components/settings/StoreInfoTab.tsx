
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload } from "lucide-react";


interface StoreInfoTabProps {
  settings: {
    storeName: string;
    storeLogo: string;
    storeGovernorate: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const StoreInfoTab = ({ settings, setSettings }: StoreInfoTabProps) => {

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setSettings((prev: any) => ({ ...prev, storeLogo: objectUrl }));
    }
  };

  return (
    <Card className="border-0 shadow-none bg-gray-50 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-right text-xl text-black">معلومات المتجر الأساسية</CardTitle>
        <CardDescription className="text-right text-gray-600">
          قم بتحديث اسم المتجر والشعار
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-right block text-black font-medium">اسم المتجر</Label>
          <Input
            value={settings.storeName}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, storeName: e.target.value }))}
            className="text-right rounded-2xl border-gray-200 text-black"
            placeholder="أدخل اسم المتجر"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-right block text-black font-medium">محافظة المتجر</Label>
          <Input
            value={settings.storeGovernorate}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, storeGovernorate: e.target.value }))}
            className="text-right rounded-2xl border-gray-200 text-black"
            placeholder="أدخل محافظة المتجر"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-right block text-black font-medium">شعار المتجر</Label>
          <div className="flex items-center gap-6">
            <Avatar className="w-24 h-24">
              {settings.storeLogo ? (
                <AvatarImage src={settings.storeLogo} alt="شعار المتجر" />
              ) : (
                <AvatarFallback className="text-3xl">🍽️</AvatarFallback>
              )}
            </Avatar>
            
            <div className="flex-1">
              <label htmlFor="logo-upload" className="cursor-pointer">
                <div className="flex items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-2xl hover:bg-gray-50 hover:border-indigo-300 transition-colors">
                  <Upload className="w-6 h-6 ml-3 text-gray-500" />
                  <span className="text-gray-600">رفع شعار جديد</span>
                </div>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StoreInfoTab;
