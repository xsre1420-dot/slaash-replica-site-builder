
import { useState } from "react";
import { Settings, User, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface StoreHeaderProps {
  storeLogo: string;
  storeName: string;
  onUpdateStore: (logo: string, name: string) => void;
}

const StoreHeader = ({ storeLogo, storeName, onUpdateStore }: StoreHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(storeName);
  const [logo, setLogo] = useState(storeLogo);
  const { toast } = useToast();

  const handleSaveChanges = () => {
    onUpdateStore(logo, name);
    setIsEditing(false);
    toast({
      title: "تم الحفظ",
      description: "تم تحديث معلومات المتجر بنجاح",
    });
  };

  return (
    <div className="bg-red-700 py-3 px-4 flex justify-between items-center text-white">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="rounded-full p-2 h-auto w-auto bg-red-600 hover:bg-red-800">
          <Settings className="h-5 w-5" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="rounded-full p-2 h-auto w-auto bg-red-600 hover:bg-red-800">
              <User className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-right">إعدادات المتجر</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium block text-right">شعار المتجر</label>
                    <Input 
                      type="text" 
                      value={logo} 
                      onChange={(e) => setLogo(e.target.value)}
                      className="text-right" 
                      placeholder="رابط الشعار"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium block text-right">اسم المتجر</label>
                    <Input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="text-right" 
                      placeholder="اسم المتجر"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      إلغاء
                    </Button>
                    <Button onClick={handleSaveChanges}>
                      حفظ
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                      {logo ? (
                        <img src={logo} alt="شعار المتجر" className="w-16 h-16 object-contain" />
                      ) : (
                        <div className="text-3xl text-gray-400">🍽️</div>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-lg">{name}</p>
                  </div>
                  <Button className="w-full" onClick={() => setIsEditing(true)}>
                    تعديل معلومات المتجر
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="rounded-full p-2 h-auto w-auto bg-red-600 hover:bg-red-800">
              <LinkIcon className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-3">
              <h3 className="font-bold text-lg text-right">مشاركة رابط المتجر</h3>
              <div className="flex gap-2">
                <Button onClick={() => {
                  navigator.clipboard.writeText("https://yourstore.com/menu");
                  toast({
                    title: "تم النسخ",
                    description: "تم نسخ الرابط بنجاح",
                  });
                }}>
                  نسخ
                </Button>
                <Input 
                  value="https://yourstore.com/menu" 
                  readOnly 
                  className="text-left bg-gray-50"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="text-xl font-bold">{storeName}</div>
        {logo && <img src={logo} alt="شعار المتجر" className="w-8 h-8 object-contain" />}
      </div>
    </div>
  );
};

export default StoreHeader;
