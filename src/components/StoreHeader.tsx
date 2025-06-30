
import { useState } from "react";
import { Settings, User, Link as LinkIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom";

interface StoreHeaderProps {
  storeLogo: string;
  storeName: string;
  onUpdateStore: (logo: string, name: string) => void;
}

const StoreHeader = ({ storeLogo, storeName, onUpdateStore }: StoreHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(storeName);
  const [logo, setLogo] = useState(storeLogo);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      // Create a temporary URL for preview
      const objectUrl = URL.createObjectURL(file);
      setLogo(objectUrl);
    }
  };

  const handleSaveChanges = () => {
    // In a real app, you would upload the image to a server here
    // and get back the URL. For now, we'll just use the temporary URL
    onUpdateStore(logo, name);
    setIsEditing(false);
    toast({
      title: "تم الحفظ",
      description: "تم تحديث معلومات المتجر بنجاح",
    });
  };

  return (
    <div className="bg-white text-gray-800 py-3 px-4 flex justify-between items-center border-b border-gray-100">
      <div className="flex items-center gap-3">
        <Link to="/settings">
          <Button variant="ghost" className="rounded-full p-2 h-auto w-auto text-white shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #5b47f5, #4c3ef7)',
                    boxShadow: '0 4px 15px rgba(91, 71, 245, 0.3)'
                  }}>
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="rounded-full p-2 h-auto w-auto text-white shadow-lg"
                    style={{ 
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                    }}>
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
                    <div className="flex flex-col items-center gap-2">
                      <Avatar className="w-20 h-20 rounded-full overflow-visible bg-transparent border-0">
                        {logo ? (
                          <AvatarImage src={logo} alt="شعار المتجر" className="object-contain" />
                        ) : (
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl">🍽️</AvatarFallback>
                        )}
                      </Avatar>
                      
                      <div className="flex w-full flex-col gap-2">
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          <div className="flex items-center justify-center w-full p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-center text-gray-700 text-sm">
                            <Upload className="h-4 w-4 ml-2" />
                            تحميل شعار جديد
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
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium block text-right">اسم المتجر</label>
                    <Input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="text-right text-blue-600 focus:border-blue-500 focus:ring-blue-500" 
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
                    <Avatar className="w-20 h-20 rounded-full overflow-visible bg-transparent">
                      {logo ? (
                        <AvatarImage src={logo} alt="شعار المتجر" className="object-contain" />
                      ) : (
                        <AvatarFallback className="text-3xl text-primary bg-primary/10">🍽️</AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-xl text-blue-600 font-serif">{name}</p>
                  </div>
                  <Button className="w-full" onClick={() => setIsEditing(true)}>
                    تعديل معلومات المتجر
                  </Button>
                  <Link to="/settings" className="block">
                    <Button variant="outline" className="w-full">
                      إعدادات متقدمة
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="rounded-full p-2 h-auto w-auto text-white shadow-lg"
                    style={{ 
                      background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
                      boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
                    }}>
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
      
      <div className="flex items-center gap-3">
        <div className="text-2xl font-bold font-serif text-gray-800">{storeName}</div>
      </div>
    </div>
  );
};

export default StoreHeader;
