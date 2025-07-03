
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, ChevronLeft, ChevronRight, Star } from "lucide-react";


interface ImagesTabProps {
  settings: {
    bannerImages: string[];
    primaryBannerIndex: number;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const ImagesTab = ({ settings, setSettings }: ImagesTabProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
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
            onChange={handleImageUpload}
          />
        </label>
      </CardContent>
    </Card>
  );
};

export default ImagesTab;
