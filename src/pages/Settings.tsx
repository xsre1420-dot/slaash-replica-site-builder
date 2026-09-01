import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/context/StoreContext";
import { toast } from "sonner";
import { Store, Truck, FileText, Globe, Loader2, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import StoreInfoTab from "@/components/settings/StoreInfoTab";
import DeliveryTab from "@/components/settings/DeliveryTab";
import PoliciesTab from "@/components/settings/PoliciesTab";
import WhatsAppTab from "@/components/settings/WhatsAppTab";
import DesignTab from "@/components/settings/DesignTab";
import CustomDomainTab from "@/components/settings/CustomDomainTab";
import { validateStoreSlug, normalizeStoreSlugInput } from "@/lib/storeSlug";
import { ATTENTION_PARAM } from "@/lib/attentionHighlight";
import { saveMerchantComplianceSettings } from "@/services/storeService";
import type { StoreSettings } from "@/types/store";
import {
  useSettingsPageBundle,
  invalidateSettingsPageBundle,
  settingsFormFromBundle,
} from "@/hooks/useSettingsPageBundle";

const Settings = () => {
  const { user } = useAuth();
  const { updateStore, updateStoreSettings } = useStore();
  const { loading: bundleLoading, bundle, domain, domainLoading, loadDomain } = useSettingsPageBundle();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const isDbLoaded = useRef(false);
  const settingsDirtyRef = useRef(false);
  const lastSavedRef = useRef<string>("");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('store');

  const [settings, setSettings] = useState({
    storeName: "",
    storeLogo: "",
    storeGovernorate: "",
    storeSlug: "",
    menuBackgroundColor: "#ffffff",
    menuTextColor: "#333333",
    menuAccentColor: "#6366f1",
    storeFont: "Tajawal",
    bannerImages: [] as string[],
    primaryBannerIndex: 0,
    deliveryPrices: [] as StoreSettings['deliveryPrices'],
    returnPolicy: "",
    termsConditions: "",
    privacyPolicy: "",
    whatsappNumber: "",
    whatsappWelcomeMessage: "",
    whatsappOrderConfirmation: "",
  });

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!bundle || settingsDirtyRef.current) return;
    const form = settingsFormFromBundle(bundle);
    setSettings(form);
    lastSavedRef.current = JSON.stringify(form);
    isDbLoaded.current = true;
  }, [bundle]);

  useEffect(() => {
    if (activeTab === 'domain' && user?.id) {
      void loadDomain();
    }
  }, [activeTab, user?.id, loadDomain]);

  useEffect(() => {
    const attention = searchParams.get(ATTENTION_PARAM);
    if (attention === 'missing-slug') {
      setActiveTab('store');
    }
    if (attention === 'missing-delivery-prices') {
      setActiveTab('delivery');
    }
  }, [searchParams]);

  const performSave = useCallback(async () => {
    const current = settingsRef.current;
    const settingsHash = JSON.stringify(current);
    if (settingsHash === lastSavedRef.current) return;

    const hasBlobUrls =
      current.storeLogo?.startsWith('blob:') ||
      current.bannerImages.some((url: string) => url.startsWith('blob:'));
    if (hasBlobUrls) {
      setSaveStatus('pending');
      return;
    }

    const normalizedSlug = normalizeStoreSlugInput(current.storeSlug);
    const slugError = normalizedSlug ? validateStoreSlug(normalizedSlug) : null;
    if (slugError) {
      setSaveStatus('error');
      toast.error(slugError, { id: "settings-slug-error" });
      return;
    }

    setSaveStatus('saving');
    try {
      await updateStore(current.storeLogo, current.storeName, current.storeGovernorate);
      await updateStoreSettings({
        menuBackgroundColor: current.menuBackgroundColor,
        menuTextColor: current.menuTextColor,
        menuAccentColor: current.menuAccentColor,
        storeFont: current.storeFont || "Tajawal",
        bannerImages: current.bannerImages,
        primaryBannerIndex: current.primaryBannerIndex,
        deliveryPrices: current.deliveryPrices,
      });
      if (user?.id) {
        const saveResult = await saveMerchantComplianceSettings(user.id, {
          storeSlug: normalizedSlug,
          returnPolicy: current.returnPolicy,
          privacyPolicy: current.privacyPolicy,
          termsConditions: current.termsConditions,
          whatsappNumber: current.whatsappNumber,
          whatsappWelcomeMessage: current.whatsappWelcomeMessage,
          whatsappOrderConfirmation: current.whatsappOrderConfirmation,
          paymentCashOnDelivery: true,
          paymentCreditCard: false,
          paymentEwallet: false,
        });

        if (!saveResult.success) {
          const message =
            saveResult.error?.includes('unique') || saveResult.error?.includes('23505')
              ? 'رابط المتجر مستخدم بالفعل — اختر رابطاً آخر'
              : saveResult.error || 'فشل في حفظ رابط المتجر';
          throw new Error(message);
        }

        invalidateSettingsPageBundle(user.id);
      }

      lastSavedRef.current = settingsHash;
      settingsDirtyRef.current = false;
      setSaveStatus('saved');
      toast.success("تم الحفظ", { duration: 1500, id: "settings-save" });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
      const message = error instanceof Error ? error.message : 'فشل في حفظ الإعدادات';
      toast.error(message, { id: "settings-error" });
    }
  }, [updateStore, updateStoreSettings, user?.id]);

  useEffect(() => {
    if (isFirstRender.current || !isDbLoaded.current) {
      if (isFirstRender.current) isFirstRender.current = false;
      return;
    }

    settingsDirtyRef.current = true;
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
  ];

  if (bundleLoading && !isDbLoaded.current) {
    return (
      <DashboardLayout>
        <PageHeader
          title="الإعدادات"
          description="خصّص متجرك، التوصيل، السياسات، والتواصل — يتم الحفظ تلقائياً"
          hideBack
          breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'الإعدادات' }]}
        />
        <div className="ds-page max-w-5xl flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="الإعدادات"
        description="خصّص متجرك، التوصيل، السياسات، والتواصل — يتم الحفظ تلقائياً"
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
            <CustomDomainTab
              storeSlug={settings.storeSlug || ''}
              domainData={domain}
              domainLoading={domainLoading}
              onDomainMutated={() => user?.id && void loadDomain({ force: true })}
            />
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <PoliciesTab settings={settings} setSettings={setSettings} />
            <WhatsAppTab settings={settings} setSettings={setSettings} />
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
