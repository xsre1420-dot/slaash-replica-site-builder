
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, Upload, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";

const Settings = () => {
  const { toast } = useToast();
  const { storeName, storeLogo, updateStore } = useStore();
  
  const [settings, setSettings] = useState({
    storeName: storeName,
    storeLogo: storeLogo,
    menuBackgroundColor: "#ffffff",
    menuTextColor: "#333333",
    menuAccentColor: "#008080",
    bannerImages: [] as string[]
  });

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      
      if (type === 'logo') {
        setSettings(prev => ({ ...prev, storeLogo: objectUrl }));
      } else {
        setSettings(prev => ({ 
          ...prev, 
          bannerImages: [...prev.bannerImages, objectUrl] 
        }));
      }
      
      toast({
        title: "تم رفع الصورة",
        description: type === 'logo' ? "تم رفع شعار المتجر بنجاح" : "تم إضافة صورة البانر بنجاح",
      });
    }
  };

  const removeBannerImage = (index: number) => {
    setSettings(prev => ({
      ...prev,
      bannerImages: prev.bannerImages.filter((_, i) => i !== index)
    }));
    
    if (currentImageIndex >= settings.bannerImages.length - 1) {
      setCurrentImageIndex(Math.max(0, settings.bannerImages.length - 2));
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev >= settings.bannerImages.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev <= 0 ? settings.bannerImages.length - 1 : prev - 1
    );
  };

  const handleSaveSettings = () => {
    updateStore(settings.storeLogo, settings.storeName);
    
    // حفظ باقي الإعدادات في localStorage
    localStorage.setItem('storeSettings', JSON.stringify(settings));
    
    toast({
      title: "تم الحفظ",
      description: "تم حفظ إعدادات المتجر بنجاح",
    });
  };

  const loadSavedSettings = () => {
    const savedSettings = localStorage.getItem('storeSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ ...prev, ...parsed }));
    }
  };

  useEffect(() => {
    loadSavedSettings();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Header */}
      <div className="bg-primary text-white py-4 px-6">
        <div className="flex items-center justify-between">
          <Link to="/builder">
            <Button variant="ghost" className="text-white hover:bg-primary/20">
              <ArrowRight className="w-5 h-5 ml-2" />
              العودة
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">إعدادات المتجر</h1>
          <div></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <Tabs defaultValue="store" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="store">معلومات المتجر</TabsTrigger>
            <TabsTrigger value="images">الصور</TabsTrigger>
            <TabsTrigger value="design">التصميم</TabsTrigger>
          </TabsList>

          {/* معلومات المتجر */}
          <TabsContent value="store" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-right">معلومات المتجر الأساسية</CardTitle>
                <CardDescription className="text-right">
                  قم بتحديث اسم المتجر والشعار
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-right block">اسم المتجر</Label>
                  <Input
                    value={settings.storeName}
                    onChange={(e) => setSettings(prev => ({ ...prev, storeName: e.target.value }))}
                    className="text-right"
                    placeholder="أدخل اسم المتجر"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-right block">شعار المتجر</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-20 h-20">
                      {settings.storeLogo ? (
                        <AvatarImage src={settings.storeLogo} alt="شعار المتجر" />
                      ) : (
                        <AvatarFallback className="text-2xl">🍽️</AvatarFallback>
                      )}
                    </Avatar>
                    
                    <div className="flex-1">
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <div className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                          <Upload className="w-5 h-5 ml-2" />
                          رفع شعار جديد
                        </div>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, 'logo')}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* الصور */}
          <TabsContent value="images" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-right">صور البانر</CardTitle>
                <CardDescription className="text-right">
                  أضف صور البانر التي ستظهر في أعلى صفحة المنيو
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* عرض الصور المضافة */}
                {settings.bannerImages.length > 0 ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={settings.bannerImages[currentImageIndex]}
                          alt={`صورة البانر ${currentImageIndex + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {settings.bannerImages.length > 1 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                            onClick={prevImage}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                            onClick={nextImage}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 left-2 bg-red-500 text-white hover:bg-red-600"
                        onClick={() => removeBannerImage(currentImageIndex)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="text-center text-sm text-gray-500">
                      {currentImageIndex + 1} من {settings.bannerImages.length}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    لا توجد صور بانر مضافة
                  </div>
                )}

                {/* زر إضافة صورة جديدة */}
                <label htmlFor="banner-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                    <Upload className="w-6 h-6 ml-2" />
                    إضافة صورة بانر جديدة
                  </div>
                  <input
                    id="banner-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'banner')}
                  />
                </label>
              </CardContent>
            </Card>
          </TabsContent>

          {/* التصميم */}
          <TabsContent value="design" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-right">ألوان المنيو</CardTitle>
                <CardDescription className="text-right">
                  خصص ألوان صفحة المنيو لتناسب هوية متجرك
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-right block">لون الخلفية</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.menuBackgroundColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, menuBackgroundColor: e.target.value }))}
                        className="w-12 h-10 rounded border"
                      />
                      <Input
                        value={settings.menuBackgroundColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, menuBackgroundColor: e.target.value }))}
                        className="text-left"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-right block">لون النص</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.menuTextColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, menuTextColor: e.target.value }))}
                        className="w-12 h-10 rounded border"
                      />
                      <Input
                        value={settings.menuTextColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, menuTextColor: e.target.value }))}
                        className="text-left"
                        placeholder="#333333"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-right block">اللون المميز</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.menuAccentColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, menuAccentColor: e.target.value }))}
                        className="w-12 h-10 rounded border"
                      />
                      <Input
                        value={settings.menuAccentColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, menuAccentColor: e.target.value }))}
                        className="text-left"
                        placeholder="#008080"
                      />
                    </div>
                  </div>
                </div>

                {/* معاينة الألوان */}
                <div className="mt-6 p-4 rounded-lg border" style={{ backgroundColor: settings.menuBackgroundColor }}>
                  <h3 className="text-lg font-bold mb-2" style={{ color: settings.menuTextColor }}>
                    معاينة التصميم
                  </h3>
                  <p className="mb-2" style={{ color: settings.menuTextColor }}>
                    هذا نص عادي بلون النص المختار
                  </p>
                  <div className="inline-block px-4 py-2 rounded" style={{ backgroundColor: settings.menuAccentColor, color: 'white' }}>
                    نص باللون المميز
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* زر الحفظ */}
        <div className="flex justify-center mt-8">
          <Button
            onClick={handleSaveSettings}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-lg"
          >
            حفظ جميع الإعدادات
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
