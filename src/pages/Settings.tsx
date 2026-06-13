import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";
import { Store, Truck, FileText, MessageCircle, Globe, Loader2, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
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
  const isDbLoaded = useRef(false);
  const lastSavedRef = useRef<string>("");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  
  const [settings, setSettings] = useState({
    storeName: storeName,
    storeLogo: storeLogo,
    storeGovernorate: storeGovernorate,
    storeSlug: "",
    menuBackgroundColor: storeSettings.menuBackgroundColor,
    menuTextColor: storeSettings.menuTextColor,
    menuAccentColor: storeSettings.menuAccentColor,
    storeFont: storeSettings.storeFont || "Tajawal",
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
    // Load all settings from database (single source of truth)
    if (!user?.id) return;

    (supabase as any)
      .from('store_settings')
      .select('store_slug, return_policy, privacy_policy, terms_conditions, whatsapp_number, whatsapp_welcome_message, whatsapp_order_confirmation, payment_methods')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const methods = Array.isArray(data.payment_methods) ? data.payment_methods as string[] : [];
          setSettings(prev => {
            const merged = {
              ...prev,
              storeSlug: data.store_slug || prev.storeSlug,
              returnPolicy: data.return_policy || prev.returnPolicy,
              termsConditions: data.terms_conditions || prev.termsConditions,
              privacyPolicy: data.privacy_policy || prev.privacyPolicy,
              whatsappNumber: data.whatsapp_number || prev.whatsappNumber,
              whatsappWelcomeMessage: data.whatsapp_welcome_message || prev.whatsappWelcomeMessage,
              whatsappOrderConfirmation: data.whatsapp_order_confirmation || prev.whatsappOrderConfirmation,
              paymentCashOnDelivery: methods.length === 0 || methods.includes('cash_on_delivery'),
              paymentCreditCard: methods.includes('credit_card'),
              paymentEwallet: methods.includes('digital_wallet'),
            };
            lastSavedRef.current = JSON.stringify(merged);
            return merged;
          });
        } else {
          isDbLoaded.current = true;
          setSettings(prev => {
            lastSavedRef.current = JSON.stringify(prev);
            return prev;
          });
        }
        isDbLoaded.current = true;
      });
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
      storeFont: storeSettings.storeFont || "Tajawal",
      bannerImages: storeSettings.bannerImages,
      primaryBannerIndex: storeSettings.primaryBannerIndex,
      deliveryPrices: storeSettings.deliveryPrices || []
    }));
  }, [storeName, storeLogo, storeGovernorate, storeSettings]);

  const performSave = useCallback(async () => {
    const settingsHash = JSON.stringify(settings);
    if (settingsHash === lastSavedRef.current) return;

    const hasBlobUrls =
      settings.storeLogo?.startsWith('blob:') ||
      settings.bannerImages.some((url: string) => url.startsWith('blob:'));
    if (hasBlobUrls) {
      setSaveStatus('pending');
      return;
    }

    const hasPaymentMethod =
      settings.paymentCashOnDelivery || settings.paymentCreditCard || settings.paymentEwallet;
    if (!hasPaymentMethod) {
      setSaveStatus('error');
      toast.error("يجب تفعيل طريقة دفع واحدة على الأقل", { id: "settings-payment-error" });
      return;
    }

    setSaveStatus('saving');
    try {
      await updateStore(settings.storeLogo, settings.storeName, settings.storeGovernorate);
      await updateStoreSettings({
        menuBackgroundColor: settings.menuBackgroundColor,
        menuTextColor: settings.menuTextColor,
        menuAccentColor: settings.menuAccentColor,
        storeFont: settings.storeFont || "Tajawal",
        bannerImages: settings.bannerImages,
        primaryBannerIndex: settings.primaryBannerIndex,
        deliveryPrices: settings.deliveryPrices
      });
      if (user?.id) {
        await (supabase as any)
          .from('store_settings')
          .update({
            store_slug: settings.storeSlug,
            return_policy: settings.returnPolicy || null,
            privacy_policy: settings.privacyPolicy || null,
            terms_conditions: settings.termsConditions || null,
            whatsapp_number: settings.whatsappNumber || null,
            whatsapp_welcome_message: settings.whatsappWelcomeMessage || null,
            whatsapp_order_confirmation: settings.whatsappOrderConfirmation || null,
            payment_methods: [
              settings.paymentCashOnDelivery ? 'cash_on_delivery' : null,
              settings.paymentCreditCard ? 'credit_card' : null,
              settings.paymentEwallet ? 'digital_wallet' : null,
            ].filter(Boolean),
          })
          .eq('owner_id', user.id);
      }
      
      lastSavedRef.current = settingsHash;
      setSaveStatus('saved');
      toast.success("تم الحفظ", { duration: 1500, id: "settings-save" });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
      toast.error("فشل في حفظ الإعدادات", { id: "settings-error" });
    }
  }, [settings, updateStore, updateStoreSettings, user?.id]);

  useEffect(() => {
    if (isFirstRender.current || !isDbLoaded.current) {
      if (isFirstRender.current) isFirstRender.current = false;
      return;
    }

    setSaveStatus('pending');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [settings, performSave]);

  const tabItems = [
    { value: "store", label: "المتجر", icon: Store },
    { value: "delivery", label: "التوصيل", icon: Truck },
    { value: "domain", label: "النطاق", icon: Globe },
    { value: "policies", label: "السياسات", icon: FileText },
    { value: "communication", label: "التواصل والدفع", icon: MessageCircle },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="الإعدادات"
        description="خصّص متجرك، التوصيل، الدفع، والسياسات — يتم الحفظ تلقائياً"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'الإعدادات' }]}
        actions={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-h-[44px]">
            {saveStatus === 'pending' && <span>سيتم الحفظ...</span>}
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span className="text-success">تم الحفظ</span>
              </>
            )}
            {saveStatus === 'error' && <span className="text-destructive">خطأ في الحفظ</span>}
          </div>
        }
      />

      <div className="ds-page max-w-5xl">
        <Tabs defaultValue="store" className="w-full">
          <TabsList className="flex w-full overflow-x-auto scrollbar-hide rounded-xl p-1 h-auto gap-1 mb-6 lg:mb-8">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2.5 flex-1 min-w-0"
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

          <TabsContent value="domain" className="space-y-6">
            <CustomDomainTab storeSlug={settings.storeSlug || ''} />
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
    </DashboardLayout>
  );
};

export default Settings;
