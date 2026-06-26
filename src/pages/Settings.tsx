import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
import { validateStoreSlug, normalizeStoreSlugInput } from "@/lib/storeSlug";
import { ATTENTION_PARAM } from "@/lib/attentionHighlight";
import {
  fetchMerchantComplianceSettings,
  saveMerchantComplianceSettings,
} from "@/services/storeService";

const Settings = () => {
  const { user } = useAuth();
  const { storeName, storeLogo, storeGovernorate, storeSettings, updateStore, updateStoreSettings } = useStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const isDbLoaded = useRef(false);
  const lastSavedRef = useRef<string>("");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('store');
  
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
    if (!user?.id) return;

    let cancelled = false;

    void fetchMerchantComplianceSettings(user.id).then((compliance) => {
      if (cancelled) return;
      if (!compliance) {
        isDbLoaded.current = true;
        setSettings((prev) => {
          lastSavedRef.current = JSON.stringify(prev);
          return prev;
        });
        return;
      }

      setSettings((prev) => {
        const merged = {
          ...prev,
          storeSlug: compliance.storeSlug || prev.storeSlug,
          returnPolicy: compliance.returnPolicy || prev.returnPolicy,
          termsConditions: compliance.termsConditions || prev.termsConditions,
          privacyPolicy: compliance.privacyPolicy || prev.privacyPolicy,
          whatsappNumber: compliance.whatsappNumber || prev.whatsappNumber,
          whatsappWelcomeMessage: compliance.whatsappWelcomeMessage || prev.whatsappWelcomeMessage,
          whatsappOrderConfirmation: compliance.whatsappOrderConfirmation || prev.whatsappOrderConfirmation,
          paymentCashOnDelivery: compliance.paymentCashOnDelivery,
          paymentCreditCard: compliance.paymentCreditCard,
          paymentEwallet: compliance.paymentEwallet,
        };
        lastSavedRef.current = JSON.stringify(merged);
        return merged;
      });
      isDbLoaded.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (searchParams.get(ATTENTION_PARAM) === 'missing-slug') {
      setActiveTab('store');
    }
  }, [searchParams]);

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

    const normalizedSlug = normalizeStoreSlugInput(settings.storeSlug);
    const slugError = validateStoreSlug(normalizedSlug);
    if (slugError) {
      setSaveStatus('error');
      toast.error(slugError, { id: "settings-slug-error" });
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
        const saveResult = await saveMerchantComplianceSettings(user.id, {
          storeSlug: normalizedSlug,
          returnPolicy: settings.returnPolicy,
          privacyPolicy: settings.privacyPolicy,
          termsConditions: settings.termsConditions,
          whatsappNumber: settings.whatsappNumber,
          whatsappWelcomeMessage: settings.whatsappWelcomeMessage,
          whatsappOrderConfirmation: settings.whatsappOrderConfirmation,
          paymentCashOnDelivery: settings.paymentCashOnDelivery,
          paymentCreditCard: settings.paymentCreditCard,
          paymentEwallet: settings.paymentEwallet,
        });

        if (!saveResult.success) {
          const message =
            saveResult.error?.includes('unique') || saveResult.error?.includes('23505')
              ? 'رابط المتجر مستخدم بالفعل — اختر رابطاً آخر'
              : saveResult.error || 'فشل في حفظ رابط المتجر';
          throw new Error(message);
        }
      }
      
      lastSavedRef.current = settingsHash;
      setSaveStatus('saved');
      toast.success("تم الحفظ", { duration: 1500, id: "settings-save" });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
      const message = error instanceof Error ? error.message : 'فشل في حفظ الإعدادات';
      toast.error(message, { id: "settings-error" });
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
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [settings, performSave]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (isDbLoaded.current) {
        void performSave();
      }
    };
  }, [performSave]);

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
