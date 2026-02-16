
import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";
import { Store, Palette, Truck, FileText, MessageCircle, CreditCard } from "lucide-react";
import SettingsHeader from "@/components/settings/SettingsHeader";
import StoreInfoTab from "@/components/settings/StoreInfoTab";
import DeliveryTab from "@/components/settings/DeliveryTab";
import DesignTab from "@/components/settings/DesignTab";
import PoliciesTab from "@/components/settings/PoliciesTab";
import WhatsAppTab from "@/components/settings/WhatsAppTab";
import PaymentTab from "@/components/settings/PaymentTab";

const Settings = () => {
  const { storeName, storeLogo, storeGovernorate, storeSettings, updateStore, updateStoreSettings } = useStore();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  
  const [settings, setSettings] = useState({
    storeName: storeName,
    storeLogo: storeLogo,
    storeGovernorate: storeGovernorate,
    menuBackgroundColor: storeSettings.menuBackgroundColor,
    menuTextColor: storeSettings.menuTextColor,
    menuAccentColor: storeSettings.menuAccentColor,
    bannerImages: storeSettings.bannerImages,
    primaryBannerIndex: storeSettings.primaryBannerIndex,
    deliveryPrices: storeSettings.deliveryPrices || [],
    // New fields
    returnPolicy: "",
    termsConditions: "",
    privacyPolicy: "",
    whatsappNumber: "",
    whatsappWelcomeMessage: "",
    whatsappOrderConfirmation: "",
    paymentCashOnDelivery: true,
    paymentCreditCard: false,
    paymentEwallet: false,
  });

  // Load extra settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("extra_store_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      storeName,
      storeLogo,
      storeGovernorate,
      menuBackgroundColor: storeSettings.menuBackgroundColor,
      menuTextColor: storeSettings.menuTextColor,
      menuAccentColor: storeSettings.menuAccentColor,
      bannerImages: storeSettings.bannerImages,
      primaryBannerIndex: storeSettings.primaryBannerIndex,
      deliveryPrices: storeSettings.deliveryPrices || []
    }));
  }, [storeName, storeLogo, storeGovernorate, storeSettings]);

  // Auto-save with debounce
  const performSave = useCallback(async () => {
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
      // Save extra fields to localStorage until DB migration runs
      localStorage.setItem("extra_store_settings", JSON.stringify({
        returnPolicy: settings.returnPolicy,
        termsConditions: settings.termsConditions,
        privacyPolicy: settings.privacyPolicy,
        whatsappNumber: settings.whatsappNumber,
        whatsappWelcomeMessage: settings.whatsappWelcomeMessage,
        whatsappOrderConfirmation: settings.whatsappOrderConfirmation,
        paymentCashOnDelivery: settings.paymentCashOnDelivery,
        paymentCreditCard: settings.paymentCreditCard,
        paymentEwallet: settings.paymentEwallet,
      }));
      
      toast.success("تم الحفظ تلقائياً", { duration: 2000 });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("فشل في حفظ الإعدادات");
    }
  }, [settings, updateStore, updateStoreSettings]);

  // Auto-save when settings change (debounced)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [settings]);

  const tabItems = [
    { value: "store", label: "المتجر", icon: Store },
    { value: "design", label: "التصميم", icon: Palette },
    { value: "delivery", label: "التوصيل", icon: Truck },
    { value: "policies", label: "السياسات", icon: FileText },
    { value: "whatsapp", label: "واتساب", icon: MessageCircle },
    { value: "payment", label: "الدفع", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background font-arabic relative">
      <SettingsHeader />

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-card rounded-3xl shadow-sm p-4 sm:p-8">
          <Tabs defaultValue="store" className="w-full">
            <TabsList className="flex flex-wrap w-full bg-muted rounded-2xl p-1 h-auto gap-1">
              {tabItems.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-xl text-foreground flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-4 py-2 flex-1 min-w-[70px]"
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="store" className="space-y-6 mt-8">
              <StoreInfoTab settings={settings} setSettings={setSettings} />
            </TabsContent>

            <TabsContent value="design" className="space-y-6 mt-8">
              <DesignTab settings={settings} setSettings={setSettings} />
            </TabsContent>

            <TabsContent value="delivery" className="space-y-6 mt-8">
              <DeliveryTab settings={settings} setSettings={setSettings} />
            </TabsContent>

            <TabsContent value="policies" className="space-y-6 mt-8">
              <PoliciesTab settings={settings} setSettings={setSettings} />
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-6 mt-8">
              <WhatsAppTab settings={settings} setSettings={setSettings} />
            </TabsContent>

            <TabsContent value="payment" className="space-y-6 mt-8">
              <PaymentTab settings={settings} setSettings={setSettings} />
            </TabsContent>
          </Tabs>

          {/* Auto-save indicator */}
          <div className="flex justify-center mt-8">
            <p className="text-sm text-muted-foreground">يتم الحفظ تلقائياً عند إجراء أي تغيير</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
