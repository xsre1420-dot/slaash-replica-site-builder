import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";
import { Store, Truck, FileText, MessageCircle, Globe } from "lucide-react";
import SettingsHeader from "@/components/settings/SettingsHeader";
import StoreInfoTab from "@/components/settings/StoreInfoTab";
import DeliveryTab from "@/components/settings/DeliveryTab";
import PoliciesTab from "@/components/settings/PoliciesTab";
import WhatsAppTab from "@/components/settings/WhatsAppTab";
import PaymentTab from "@/components/settings/PaymentTab";
import DesignTab from "@/components/settings/DesignTab";
import CustomDomainTab from "@/components/settings/CustomDomainTab";

const Settings = () => {
  const { user } = useAuth();
  const { storeName, storeLogo, storeGovernorate, storeSettings, updateStore, updateStoreSettings } = useStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const lastSavedRef = useRef<string>("");
  
  const [settings, setSettings] = useState({
    storeName: storeName,
    storeLogo: storeLogo,
    storeGovernorate: storeGovernorate,
    storeSlug: "",
    menuBackgroundColor: storeSettings.menuBackgroundColor,
    menuTextColor: storeSettings.menuTextColor,
    menuAccentColor: storeSettings.menuAccentColor,
    bannerImages: storeSettings.bannerImages,
    primaryBannerIndex: storeSettings.primaryBannerIndex,
    deliveryPrices: storeSettings.deliveryPrices || [],
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

  useEffect(() => {
    // Load extra settings from localStorage + slug from DB
    try {
      const saved = localStorage.getItem("extra_store_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch {}

    // Load slug from database
    if (user?.id) {
      supabase
        .from('store_settings')
        .select('store_slug')
        .eq('owner_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.store_slug) {
            setSettings(prev => ({ ...prev, storeSlug: data.store_slug }));
          }
        });
    }
  }, [user?.id]);

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

  const performSave = useCallback(async () => {
    const settingsHash = JSON.stringify(settings);
    if (settingsHash === lastSavedRef.current) return;
    
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
      // Save slug to database
      if (user?.id && settings.storeSlug) {
        await supabase
          .from('store_settings')
          .update({ store_slug: settings.storeSlug })
          .eq('owner_id', user.id);
      }
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
      
      lastSavedRef.current = settingsHash;
      toast.success("تم الحفظ", { duration: 1500, id: "settings-save" });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("فشل في حفظ الإعدادات", { id: "settings-error" });
    }
  }, [settings, updateStore, updateStoreSettings]);

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
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [settings]);

  const tabItems = [
    { value: "store", label: "المتجر", icon: Store },
    { value: "delivery", label: "التوصيل", icon: Truck },
    { value: "policies", label: "السياسات", icon: FileText },
    { value: "communication", label: "التواصل والدفع", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-background font-arabic relative">
      <SettingsHeader />

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <Tabs defaultValue="store" className="w-full">
          <TabsList className="flex w-full bg-muted rounded-xl p-1 h-auto gap-1 mb-6">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-lg text-foreground data-[state=active]:bg-card data-[state=active]:shadow-sm flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-5 py-2.5 flex-1"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="store" className="space-y-6">
            <StoreInfoTab settings={settings} setSettings={setSettings} />
            <DesignTab settings={settings} setSettings={setSettings} />
          </TabsContent>

          <TabsContent value="delivery" className="space-y-6">
            <DeliveryTab settings={settings} setSettings={setSettings} />
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <PoliciesTab settings={settings} setSettings={setSettings} />
          </TabsContent>

          <TabsContent value="communication" className="space-y-6">
            <WhatsAppTab settings={settings} setSettings={setSettings} />
            <PaymentTab settings={settings} setSettings={setSettings} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-center mt-6 pb-6">
          <p className="text-xs text-muted-foreground">يتم الحفظ تلقائياً عند إجراء أي تغيير</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
