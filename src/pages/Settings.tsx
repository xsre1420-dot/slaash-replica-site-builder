
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";
import SettingsHeader from "@/components/settings/SettingsHeader";
import StoreInfoTab from "@/components/settings/StoreInfoTab";
import DeliveryTab from "@/components/settings/DeliveryTab";
import ImagesTab from "@/components/settings/ImagesTab";
import DesignTab from "@/components/settings/DesignTab";
import SettingsActions from "@/components/settings/SettingsActions";

const Settings = () => {
  const { storeName, storeLogo, storeGovernorate, storeSettings, updateStore, updateStoreSettings } = useStore();
  
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

  const handleSaveSettings = async () => {
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
      
      // Show success notification with Sonner
      toast.success("تم حفظ الإعدادات بنجاح!", {
        description: "تم تحديث جميع إعدادات المتجر",
        duration: 4000,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("فشل في حفظ الإعدادات", {
        description: "حدث خطأ أثناء محاولة حفظ الإعدادات",
        duration: 4000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-arabic relative">
      <SettingsHeader />
      
      {/* Test notification button */}
      <div className="fixed top-4 left-4 z-50">
        <button 
          onClick={() => toast.success("اختبار الإشعار مع زر الإغلاق", {
            description: "هذا إشعار تجريبي لاختبار زر الإغلاق",
            duration: 10000,
          })}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
        >
          اختبار إشعار
        </button>
      </div>

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

          <SettingsActions onSave={handleSaveSettings} />
        </div>
      </div>
    </div>
  );
};

export default Settings;
