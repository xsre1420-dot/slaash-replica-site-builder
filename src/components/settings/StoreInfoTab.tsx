import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload, X, ChevronLeft, ChevronRight, Star, ImageIcon } from "lucide-react";


interface StoreInfoTabProps {
  settings: {
    storeName: string;
    storeLogo: string;
    storeGovernorate: string;
    bannerImages: string[];
    primaryBannerIndex: number;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const StoreInfoTab = ({ settings, setSettings }: StoreInfoTabProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setSettings((prev: any) => ({ ...prev, storeLogo: objectUrl }));
    }
  };

  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setSettings((prev: any) => ({ 
        ...prev, 
        bannerImages: [...prev.bannerImages, objectUrl] 
      }));
    }
  };

  const removeBannerImage = (index: number) => {
    setSettings((prev: any) => {
      const newImages = prev.bannerImages.filter((_: any, i: number) => i !== index);
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
    setSettings((prev: any) => ({
      ...prev,
      primaryBannerIndex: index
    }));
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

  return (
    <div className="space-y-6">
      {/* Store Name and Logo Card */}
      <Card className="border-0 shadow-none bg-gray-50 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-right text-xl text-black">معلومات المتجر الأساسية</CardTitle>
          <CardDescription className="text-right text-gray-600">
            قم بتحديث اسم المتجر والشعار
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Store Name */}
          <div className="space-y-3">
            <Label className="text-right block text-black font-medium">اسم المتجر</Label>
            <Input
              value={settings.storeName}
              onChange={(e) => setSettings((prev: any) => ({ ...prev, storeName: e.target.value }))}
              className="text-right rounded-2xl border-gray-200 text-black"
              placeholder="أدخل اسم المتجر"
            />
          </div>

          {/* Store Logo */}
          <div className="space-y-3">
            <Label className="text-right block text-black font-medium">شعار المتجر</Label>
            <div className="bg-white p-6 rounded-2xl border-2 border-gray-200">
              <div className="flex flex-col items-center gap-6">
                {settings.storeLogo ? (
                  <div className="relative">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-gray-200 bg-white">
                      <img src={settings.storeLogo} alt="شعار المتجر" className="w-full h-full object-contain" />
                    </div>
                    <button
                      onClick={() => setSettings((prev: any) => ({ ...prev, storeLogo: '' }))}
                      className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-all shadow-lg hover:scale-110"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                
                <label htmlFor="logo-upload" className="cursor-pointer w-full">
                  <div className="flex items-center justify-center w-full p-5 border-2 border-dashed border-primary/30 rounded-2xl hover:bg-primary/5 hover:border-primary/50 transition-all">
                    <Upload className="w-6 h-6 ml-3 text-primary" />
                    <span className="text-primary font-medium">رفع شعار جديد</span>
                  </div>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banner Images Card */}
      <Card className="border-0 shadow-none bg-gray-50 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-right text-xl text-black">صور البانر</CardTitle>
          <CardDescription className="text-right text-gray-600">
            أضف صور البانر وحدد الصورة الرئيسية التي ستظهر أولاً في المتجر
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.bannerImages.length > 0 ? (
            <div className="space-y-6">
              <div className="relative bg-white p-4 rounded-2xl">
                <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden">
                  <img
                    src={settings.bannerImages[currentImageIndex]}
                    alt={`صورة البانر ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {currentImageIndex === settings.primaryBannerIndex && (
                  <div className="absolute top-8 right-8 bg-yellow-500 text-white p-3 rounded-2xl shadow-lg">
                    <Star className="w-5 h-5 fill-current" />
                  </div>
                )}
                
                {settings.bannerImages.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-8 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 rounded-2xl w-12 h-12"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-8 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 rounded-2xl w-12 h-12"
                      onClick={nextImage}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </>
                )}
                
                <div className="absolute bottom-8 left-8 flex gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-red-500 text-white hover:bg-red-600 rounded-2xl w-12 h-12 shadow-lg"
                    onClick={() => removeBannerImage(currentImageIndex)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  
                  {currentImageIndex !== settings.primaryBannerIndex && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="bg-yellow-500 text-white hover:bg-yellow-600 rounded-2xl w-12 h-12 shadow-lg"
                      onClick={() => setPrimaryImage(currentImageIndex)}
                    >
                      <Star className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="text-center text-gray-600 font-medium">
                {currentImageIndex + 1} من {settings.bannerImages.length}
                {currentImageIndex === settings.primaryBannerIndex && " (الصورة الرئيسية)"}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500 bg-white rounded-2xl">
              <div className="text-6xl mb-4">📷</div>
              <p className="text-lg">لا توجد صور بانر مضافة</p>
            </div>
          )}

          <label htmlFor="banner-upload" className="cursor-pointer block">
            <div className="flex items-center justify-center w-full p-6 border-2 border-dashed border-primary/30 rounded-2xl hover:bg-primary/5 hover:border-primary/50 transition-all bg-white">
              <Upload className="w-6 h-6 ml-3 text-primary" />
              <span className="text-primary font-medium">إضافة صورة بانر جديدة</span>
            </div>
            <input
              id="banner-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
            />
          </label>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreInfoTab;
