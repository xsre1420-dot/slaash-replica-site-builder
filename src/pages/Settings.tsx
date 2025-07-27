
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";
import SettingsHeader from "@/components/settings/SettingsHeader";
import StoreInfoTab from "@/components/settings/StoreInfoTab";
import DeliveryTab from "@/components/settings/DeliveryTab";
import ImagesTab from "@/components/settings/ImagesTab";
import DesignTab from "@/components/settings/DesignTab";
// SettingsActions removed - auto-save is now enabled

const Settings = () => {
  const { storeName, storeLogo, storeGovernorate, storeSettings, updateStore, updateStoreSettings } = useStore();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [settings, setSettings] = useState({
    storeName: storeName,
    storeLogo: storeLogo,
    storeGovernorate: storeGovernorate,
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
      storeGovernorate,
      menuBackgroundColor: storeSettings.menuBackgroundColor,
      menuTextColor: storeSettings.menuTextColor,
      menuAccentColor: storeSettings.menuAccentColor,
      bannerImages: storeSettings.bannerImages,
      primaryBannerIndex: storeSettings.primaryBannerIndex,
      deliveryPrices: storeSettings.deliveryPrices || []
    });
  }, [storeName, storeLogo, storeGovernorate, storeSettings]);

  // Auto-save function with debouncing
  const autoSave = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateStore(settings.storeLogo, settings.storeName, settings.storeGovernorate);
        await updateStoreSettings({
          menuBackgroundColor: settings.menuBackgroundColor,
          menuTextColor: settings.menuTextColor,
          menuAccentColor: settings.menuAccentColor,
          bannerImages: settings.bannerImages,
          primaryBannerIndex: settings.primaryBannerIndex,
          deliveryPrices: settings.deliveryPrices
        });
      } catch (error) {
        console.error('Error auto-saving settings:', error);
      }
    }, 1000); // 1 second debounce for auto-save
  };

  // Auto-save when settings change
  useEffect(() => {
    autoSave();
  }, [settings]);

  return (
    <div className="min-h-screen bg-gray-50 font-arabic relative">
      <SettingsHeader />

      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8">
          <Tabs defaultValue="store" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-100 rounded-2xl p-1">
              <TabsTrigger value="store" className="rounded-xl text-black">معلومات المتجر</TabsTrigger>
              <TabsTrigger value="images" className="rounded-xl text-black">الصور</TabsTrigger>
              <TabsTrigger value="design" className="rounded-xl text-black">التصميم</TabsTrigger>
              <TabsTrigger value="delivery" className="rounded-xl text-black">التوصيل</TabsTrigger>
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

        </div>
      </div>
    </div>
  );
};

export default Settings;
