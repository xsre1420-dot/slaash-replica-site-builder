
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/context/StoreContext";
import SettingsHeader from "@/components/settings/SettingsHeader";
import StoreInfoTab from "@/components/settings/StoreInfoTab";
import DeliveryTab from "@/components/settings/DeliveryTab";
import ImagesTab from "@/components/settings/ImagesTab";
import DesignTab from "@/components/settings/DesignTab";
import SettingsActions from "@/components/settings/SettingsActions";

const Settings = () => {
  const { toast } = useToast();
  const { storeName, storeLogo, storeSettings, updateStore, updateStoreSettings } = useStore();
  
  const [settings, setSettings] = useState({
    storeName: storeName,
    storeLogo: storeLogo,
    menuBackgroundColor: storeSettings.menuBackgroundColor,
    menuTextColor: storeSettings.menuTextColor,
    menuAccentColor: storeSettings.menuAccentColor,
    bannerImages: storeSettings.bannerImages,
    primaryBannerIndex: storeSettings.primaryBannerIndex,
    deliveryPrices: storeSettings.deliveryPrices || []
  });

  useEffect(() => {
    setSettings({
      storeName,
      storeLogo,
      menuBackgroundColor: storeSettings.menuBackgroundColor,
      menuTextColor: storeSettings.menuTextColor,
      menuAccentColor: storeSettings.menuAccentColor,
      bannerImages: storeSettings.bannerImages,
      primaryBannerIndex: storeSettings.primaryBannerIndex,
      deliveryPrices: storeSettings.deliveryPrices || []
    });
  }, [storeName, storeLogo, storeSettings]);

  const handleSaveSettings = () => {
    updateStore(settings.storeLogo, settings.storeName);
    updateStoreSettings({
      menuBackgroundColor: settings.menuBackgroundColor,
      menuTextColor: settings.menuTextColor,
      menuAccentColor: settings.menuAccentColor,
      bannerImages: settings.bannerImages,
      primaryBannerIndex: settings.primaryBannerIndex,
      deliveryPrices: settings.deliveryPrices
    });
    
    toast({
      title: "تم الحفظ",
      description: "تم حفظ إعدادات المتجر بنجاح",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      <SettingsHeader />

      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8">
          <Tabs defaultValue="store" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-100 rounded-2xl p-1">
              <TabsTrigger value="store" className="rounded-xl">معلومات المتجر</TabsTrigger>
              <TabsTrigger value="images" className="rounded-xl">الصور</TabsTrigger>
              <TabsTrigger value="design" className="rounded-xl">التصميم</TabsTrigger>
              <TabsTrigger value="delivery" className="rounded-xl">التوصيل</TabsTrigger>
            </TabsList>

            <TabsContent value="store" className="space-y-6 mt-8">
              <StoreInfoTab settings={settings} setSettings={setSettings} />
            </TabsContent>

            <TabsContent value="images" className="space-y-6 mt-8">
              <ImagesTab settings={settings} setSettings={setSettings} />
            </TabsContent>

            <TabsContent value="design" className="space-y-6 mt-8">
              <DesignTab settings={settings} setSettings={setSettings} />
            </TabsContent>

            <TabsContent value="delivery" className="space-y-6 mt-8">
              <DeliveryTab settings={settings} setSettings={setSettings} />
            </TabsContent>
          </Tabs>

          <SettingsActions onSave={handleSaveSettings} />
        </div>
      </div>
    </div>
  );
};

export default Settings;
