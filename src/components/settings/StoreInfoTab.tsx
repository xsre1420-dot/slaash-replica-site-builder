import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X, ChevronLeft, ChevronRight, Star, ImageIcon, Store } from "lucide-react";

interface StoreInfoTabProps {
  settings: {
    storeName: string;
    storeLogo: string;
    storeGovernorate: string;
    storeSlug: string;
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
      if (index === prev.primaryBannerIndex) newPrimaryIndex = 0;
      else if (index < prev.primaryBannerIndex) newPrimaryIndex = prev.primaryBannerIndex - 1;
      return { ...prev, bannerImages: newImages, primaryBannerIndex: Math.min(newPrimaryIndex, newImages.length - 1) };
    });
    if (currentImageIndex >= settings.bannerImages.length - 1) {
      setCurrentImageIndex(Math.max(0, settings.bannerImages.length - 2));
    }
  };

  const setPrimaryImage = (index: number) => {
    setSettings((prev: any) => ({ ...prev, primaryBannerIndex: index }));
  };

  const nextImage = () => setCurrentImageIndex((prev) => prev >= settings.bannerImages.length - 1 ? 0 : prev + 1);
  const prevImage = () => setCurrentImageIndex((prev) => prev <= 0 ? settings.bannerImages.length - 1 : prev - 1);

  return (
    <div className="space-y-6">
      {/* Store Name and Logo */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 justify-end">
          <h3 className="text-lg font-bold text-foreground">معلومات المتجر</h3>
          <Store className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <Label className="text-right block text-foreground font-medium">اسم المتجر</Label>
          <Input
            value={settings.storeName}
            onChange={(e) => setSettings((prev: any) => ({ ...prev, storeName: e.target.value }))}
            className="text-right rounded-xl border-border"
            placeholder="أدخل اسم المتجر"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-right block text-foreground font-medium">رابط المتجر (Slug)</Label>
          <div className="flex items-center gap-2 direction-ltr">
            <span className="text-xs text-muted-foreground whitespace-nowrap">/store/</span>
            <Input
              value={settings.storeSlug || ''}
              onChange={(e) => {
                const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                setSettings((prev: any) => ({ ...prev, storeSlug: slug }));
              }}
              className="text-left rounded-xl border-border font-mono text-sm"
              placeholder="my-store"
              dir="ltr"
            />
          </div>
          {settings.storeSlug && (
            <p className="text-xs text-muted-foreground text-right">
              رابط متجرك: {window.location.origin}/store/{settings.storeSlug}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-right block text-foreground font-medium">شعار المتجر</Label>
          <div className="bg-muted/50 p-5 rounded-xl border border-border">
            <div className="flex flex-col items-center gap-4">
              {settings.storeLogo ? (
                <div className="relative">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-border bg-background">
                    <img src={settings.storeLogo} alt="شعار المتجر" className="w-full h-full object-contain" />
                  </div>
                  <button
                    onClick={() => setSettings((prev: any) => ({ ...prev, storeLogo: '' }))}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 transition-all hover:scale-110 shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              
              <label htmlFor="logo-upload" className="cursor-pointer w-full">
                <div className="flex items-center justify-center w-full p-3 border border-dashed border-border rounded-xl hover:bg-accent transition-colors">
                  <Upload className="w-4 h-4 ml-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-medium">رفع شعار جديد</span>
                </div>
                <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Images */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 justify-end">
          <h3 className="text-lg font-bold text-foreground">صور البانر</h3>
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-right">أضف صور البانر وحدد الصورة الرئيسية</p>

        {settings.bannerImages.length > 0 ? (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-border">
              <div className="aspect-video bg-muted">
                <img
                  src={settings.bannerImages[currentImageIndex]}
                  alt={`بانر ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {currentImageIndex === settings.primaryBannerIndex && (
                <div className="absolute top-3 right-3 bg-foreground text-background p-2 rounded-lg shadow-lg">
                  <Star className="w-4 h-4 fill-current" />
                </div>
              )}
              
              {settings.bannerImages.length > 1 && (
                <>
                  <Button variant="ghost" size="icon"
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-lg w-9 h-9"
                    onClick={prevImage}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon"
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-lg w-9 h-9"
                    onClick={nextImage}>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </>
              )}
              
              <div className="absolute bottom-3 left-3 flex gap-2">
                <Button variant="ghost" size="icon"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg w-8 h-8"
                  onClick={() => removeBannerImage(currentImageIndex)}>
                  <X className="w-4 h-4" />
                </Button>
                {currentImageIndex !== settings.primaryBannerIndex && (
                  <Button variant="ghost" size="icon"
                    className="bg-foreground text-background hover:bg-foreground/90 rounded-lg w-8 h-8"
                    onClick={() => setPrimaryImage(currentImageIndex)}>
                    <Star className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <p className="text-center text-sm text-muted-foreground">
              {currentImageIndex + 1} من {settings.bannerImages.length}
              {currentImageIndex === settings.primaryBannerIndex && " (الرئيسية)"}
            </p>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground bg-muted/50 rounded-xl border border-dashed border-border">
            <ImageIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
            <p>لا توجد صور بانر</p>
          </div>
        )}

        <label htmlFor="banner-upload" className="cursor-pointer block">
          <div className="flex items-center justify-center w-full p-3 border border-dashed border-border rounded-xl hover:bg-accent transition-colors">
            <Upload className="w-4 h-4 ml-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">إضافة صورة بانر</span>
          </div>
          <input id="banner-upload" type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
        </label>
      </div>
    </div>
  );
};

export default StoreInfoTab;
