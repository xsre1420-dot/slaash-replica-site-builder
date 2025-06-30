import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, Upload, X, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";

const Settings = () => {
  const { toast } = useToast();
  const { storeName, storeLogo, storeSettings, updateStore, updateStoreSettings } = useStore();
  
  const [settings, setSettings] = useState({
    storeName: storeName,
    storeLogo: storeLogo,
    menuBackgroundColor: storeSettings.menuBackgroundColor,
    menuTextColor: storeSettings.menuTextColor,
    menuAccentColor: "#6366f1", // تغيير اللون الافتراضي للأزرق
    bannerImages: storeSettings.bannerImages,
    primaryBannerIndex: storeSettings.primaryBannerIndex
  });

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    setSettings({
      storeName,
      storeLogo,
      menuBackgroundColor: storeSettings.menuBackgroundColor,
      menuTextColor: storeSettings.menuTextColor,
      menuAccentColor: storeSettings.menuAccentColor === "#008080" ? "#6366f1" : storeSettings.menuAccentColor, // تحويل التركوازي للأزرق
      bannerImages: storeSettings.bannerImages,
      primaryBannerIndex: storeSettings.primaryBannerIndex
    });
  }, [storeName, storeLogo, storeSettings]);

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
    setSettings(prev => {
      const newImages = prev.bannerImages.filter((_, i) => i !== index);
      let newPrimaryIndex = prev.primaryBannerIndex;
      
      if (index === prev.primaryBannerIndex) {
        newPrimaryIndex = 0;
      } else if (index < prev.primaryBannerIndex) {
        newPrimaryIndex = prev.primaryBannerIndex - 1;
      }
      
      return {
        ...prev,
        bannerImages: newImages,
        primaryBannerIndex: Math.min(newPrimaryIndex, newImages.length - 1)
      };
    });
    
    if (currentImageIndex >= settings.bannerImages.length - 1) {
      setCurrentImageIndex(Math.max(0, settings.bannerImages.length - 2));
    }
  };

  const setPrimaryImage = (index: number) => {
    setSettings(prev => ({
      ...prev,
      primaryBannerIndex: index
    }));
    toast({
      title: "تم التحديث",
      description: "تم تعيين الصورة كصورة رئيسية",
    });
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
    updateStoreSettings({
      menuBackgroundColor: settings.menuBackgroundColor,
      menuTextColor: settings.menuTextColor,
      menuAccentColor: settings.menuAccentColor,
      bannerImages: settings.bannerImages,
      primaryBannerIndex: settings.primaryBannerIndex
    });
    
    toast({
      title: "تم الحفظ",
      description: "تم حفظ إعدادات المتجر بنجاح",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Modern Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
                <ArrowRight className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">إعدادات المتجر</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8">
          <Tabs defaultValue="store" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-100 rounded-2xl p-1">
              <TabsTrigger value="store" className="rounded-xl">معلومات المتجر</TabsTrigger>
              <TabsTrigger value="images" className="rounded-xl">الصور</TabsTrigger>
              <TabsTrigger value="design" className="rounded-xl">التصميم</TabsTrigger>
            </TabsList>

            {/* Store Info Tab */}
            <TabsContent value="store" className="space-y-6 mt-8">
              <Card className="border-0 shadow-none bg-gray-50 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-right text-xl">معلومات المتجر الأساسية</CardTitle>
                  <CardDescription className="text-right text-gray-600">
                    قم بتحديث اسم المتجر والشعار
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-right block text-gray-700 font-medium">اسم المتجر</Label>
                    <Input
                      value={settings.storeName}
                      onChange={(e) => setSettings(prev => ({ ...prev, storeName: e.target.value }))}
                      className="text-right rounded-2xl border-gray-200"
                      placeholder="أدخل اسم المتجر"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-right block text-gray-700 font-medium">شعار المتجر</Label>
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
                            onChange={(e) => handleImageUpload(e, 'logo')}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-6 mt-8">
              <Card className="border-0 shadow-none bg-gray-50 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-right text-xl">صور البانر</CardTitle>
                  <CardDescription className="text-right text-gray-600">
                    أضف صور البانر وحدد الصورة الرئيسية التي ستظهر أولاً في المنيو
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {settings.bannerImages.length > 0 ? (
                    <div className="space-y-6">
                      <div className="relative">
                        <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden">
                          <img
                            src={settings.bannerImages[currentImageIndex]}
                            alt={`صورة البانر ${currentImageIndex + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {currentImageIndex === settings.primaryBannerIndex && (
                          <div className="absolute top-4 right-4 bg-yellow-500 text-white p-3 rounded-2xl">
                            <Star className="w-5 h-5 fill-current" />
                          </div>
                        )}
                        
                        {settings.bannerImages.length > 1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 rounded-2xl w-12 h-12"
                              onClick={prevImage}
                            >
                              <ChevronLeft className="w-6 h-6" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 rounded-2xl w-12 h-12"
                              onClick={nextImage}
                            >
                              <ChevronRight className="w-6 h-6" />
                            </Button>
                          </>
                        )}
                        
                        <div className="absolute bottom-4 left-4 flex gap-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="bg-red-500 text-white hover:bg-red-600 rounded-2xl w-12 h-12"
                            onClick={() => removeBannerImage(currentImageIndex)}
                          >
                            <X className="w-5 h-5" />
                          </Button>
                          
                          {currentImageIndex !== settings.primaryBannerIndex && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="bg-yellow-500 text-white hover:bg-yellow-600 rounded-2xl w-12 h-12"
                              onClick={() => setPrimaryImage(currentImageIndex)}
                            >
                              <Star className="w-5 h-5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-center text-gray-600">
                        {currentImageIndex + 1} من {settings.bannerImages.length}
                        {currentImageIndex === settings.primaryBannerIndex && " (الصورة الرئيسية)"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-4xl mb-4">📷</div>
                      <p>لا توجد صور بانر مضافة</p>
                    </div>
                  )}

                  <label htmlFor="banner-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center w-full p-8 border-2 border-dashed border-gray-300 rounded-2xl hover:bg-gray-50 hover:border-indigo-300 transition-colors">
                      <Upload className="w-6 h-6 ml-3 text-gray-500" />
                      <span className="text-gray-600">إضافة صورة بانر جديدة</span>
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

            {/* Design Tab */}
            <TabsContent value="design" className="space-y-6 mt-8">
              <Card className="border-0 shadow-none bg-gray-50 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-right text-xl">ألوان المنيو</CardTitle>
                  <CardDescription className="text-right text-gray-600">
                    خصص ألوان صفحة المنيو لتناسب هوية متجرك
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <Label className="text-right block text-gray-700 font-medium">لون الخلفية</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.menuBackgroundColor}
                          onChange={(e) => setSettings(prev => ({ ...prev, menuBackgroundColor: e.target.value }))}
                          className="w-16 h-12 rounded-2xl border border-gray-200"
                        />
                        <Input
                          value={settings.menuBackgroundColor}
                          onChange={(e) => setSettings(prev => ({ ...prev, menuBackgroundColor: e.target.value }))}
                          className="text-left rounded-2xl"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-right block text-gray-700 font-medium">لون النص</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.menuTextColor}
                          onChange={(e) => setSettings(prev => ({ ...prev, menuTextColor: e.target.value }))}
                          className="w-16 h-12 rounded-2xl border border-gray-200"
                        />
                        <Input
                          value={settings.menuTextColor}
                          onChange={(e) => setSettings(prev => ({ ...prev, menuTextColor: e.target.value }))}
                          className="text-left rounded-2xl"
                          placeholder="#333333"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-right block text-gray-700 font-medium">اللون المميز</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settings.menuAccentColor}
                          onChange={(e) => setSettings(prev => ({ ...prev, menuAccentColor: e.target.value }))}
                          className="w-16 h-12 rounded-2xl border border-gray-200"
                        />
                        <Input
                          value={settings.menuAccentColor}
                          onChange={(e) => setSettings(prev => ({ ...prev, menuAccentColor: e.target.value }))}
                          className="text-left rounded-2xl"
                          placeholder="#6366f1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Color Preview */}
                  <div className="mt-8 p-8 rounded-2xl border border-gray-200" style={{ backgroundColor: settings.menuBackgroundColor }}>
                    <h3 className="text-xl font-bold mb-4" style={{ color: settings.menuTextColor }}>
                      معاينة التصميم
                    </h3>
                    <p className="mb-4" style={{ color: settings.menuTextColor }}>
                      هذا نص عادي بلون النص المختار
                    </p>
                    <div className="inline-block px-6 py-3 rounded-2xl" style={{ backgroundColor: settings.menuAccentColor, color: 'white' }}>
                      نص باللون المميز
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <div className="flex justify-center mt-12">
            <Button
              onClick={handleSaveSettings}
              className="text-white px-12 py-4 text-lg rounded-2xl border-0 shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
              }}
            >
              حفظ جميع الإعدادات
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
