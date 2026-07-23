import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  fetchMerchantMarketingSettings,
  upsertMerchantMarketingSettings,
  type MerchantMarketingSettings,
} from "@/services/marketingService";
import MetaDiagnosticsPanel from "@/components/marketing/MetaDiagnosticsPanel";

type SettingsForm = Omit<MerchantMarketingSettings, 'store_slug' | 'facebook_access_token_configured'> & {
  facebook_access_token: string;
};

const defaultSettings = (): SettingsForm => ({
  meta_pixel_id: '',
  facebook_access_token: '',
  google_analytics_id: '',
  marketing_enabled: false,
  email_marketing_enabled: false,
  sms_marketing_enabled: false,
  meta_capi_enabled: true,
  meta_browser_events_enabled: true,
  meta_debug_mode: false,
  meta_test_event_code: '',
  meta_dataset_id: '',
});

export default function MarketingSettingsTab() {
  const { user } = useAuth();
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SettingsForm>(defaultSettings());

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const data = await fetchMerchantMarketingSettings(user.id);
    setStoreSlug(data?.store_slug || null);
    if (data) {
      setTokenConfigured(data.facebook_access_token_configured);
      setSettings({
        meta_pixel_id: data.meta_pixel_id,
        facebook_access_token: '',
        google_analytics_id: data.google_analytics_id,
        marketing_enabled: data.marketing_enabled,
        email_marketing_enabled: data.email_marketing_enabled,
        sms_marketing_enabled: data.sms_marketing_enabled,
        meta_capi_enabled: data.meta_capi_enabled,
        meta_browser_events_enabled: data.meta_browser_events_enabled,
        meta_debug_mode: data.meta_debug_mode,
        meta_test_event_code: data.meta_test_event_code,
        meta_dataset_id: data.meta_dataset_id,
      });
    }
  }, [user]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async () => {
    if (!user) return;
    setLoading(true);
    const result = await upsertMerchantMarketingSettings(user.id, settings);

    if (!result.success) toast.error("فشل في حفظ الإعدادات");
    else {
      if (result.storeSlug) setStoreSlug(result.storeSlug);
      if (settings.facebook_access_token.trim()) setTokenConfigured(true);
      setSettings((p) => ({ ...p, facebook_access_token: '' }));
      toast.success("تم حفظ إعدادات التسويق بنجاح");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/20 rounded-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-right text-base">Meta Pixel + Conversions API</CardTitle>
          <CardDescription className="text-right text-xs">
            إعدادات معزولة لمتجرك — لا تُشارك مع أي متجر آخر. رمز CAPI يُخزَّن على الخادم فقط.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border border-border/20 rounded-xl">
            <Switch
              checked={settings.marketing_enabled}
              onCheckedChange={(checked) => setSettings(p => ({ ...p, marketing_enabled: checked }))}
            />
            <div className="text-right">
              <Label>تفعيل التتبع التسويقي</Label>
              <p className="text-xs text-muted-foreground">Meta Pixel + Google Analytics</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaPixelId" className="text-right block">Meta Pixel ID</Label>
            <Input
              id="metaPixelId"
              placeholder="123456789012345"
              value={settings.meta_pixel_id}
              onChange={(e) => setSettings(p => ({ ...p, meta_pixel_id: e.target.value.replace(/\D/g, '') }))}
              className="text-right rounded-xl font-mono"
              inputMode="numeric"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="metaAccessToken" className="text-right block">Conversions API Access Token</Label>
              {tokenConfigured && (
                <Badge variant="secondary" className="text-[10px]">مُكوَّن — اترك الحقل فارغاً للإبقاء عليه</Badge>
              )}
            </div>
            <Input
              id="metaAccessToken"
              type="password"
              autoComplete="off"
              placeholder={tokenConfigured ? '••••••••••••••••' : 'أدخل Access Token من Events Manager'}
              value={settings.facebook_access_token}
              onChange={(e) => setSettings(p => ({ ...p, facebook_access_token: e.target.value }))}
              className="text-right rounded-xl font-mono"
            />
            <p className="text-xs text-muted-foreground text-right">
              لا يُعرض هذا الرمز في المتجر ولا يُرسل للمتصفح — للخادم فقط.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaTestCode" className="text-right block">Test Event Code (اختياري)</Label>
            <Input
              id="metaTestCode"
              placeholder="TEST12345"
              value={settings.meta_test_event_code}
              onChange={(e) => setSettings(p => ({ ...p, meta_test_event_code: e.target.value }))}
              className="text-right rounded-xl font-mono"
            />
            <p className="text-xs text-muted-foreground text-right">
              يُستخدم مع وضع التصحيح فقط — لاختبار الأحداث في Meta Events Manager.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 border border-border/20 rounded-xl">
              <Switch
                checked={settings.meta_browser_events_enabled}
                onCheckedChange={(checked) => setSettings(p => ({ ...p, meta_browser_events_enabled: checked }))}
              />
              <div className="text-right">
                <Label className="text-sm">أحداث المتصفح (Pixel)</Label>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border border-border/20 rounded-xl">
              <Switch
                checked={settings.meta_capi_enabled}
                onCheckedChange={(checked) => setSettings(p => ({ ...p, meta_capi_enabled: checked }))}
              />
              <div className="text-right">
                <Label className="text-sm">أحداث الخادم (CAPI)</Label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border border-border/20 rounded-xl">
            <Switch
              checked={settings.meta_debug_mode}
              onCheckedChange={(checked) => setSettings(p => ({ ...p, meta_debug_mode: checked }))}
            />
            <div className="text-right">
              <Label>وضع التصحيح</Label>
              <p className="text-xs text-muted-foreground">تسجيل تفصيلي + Test Event Code في بيئة غير الإنتاج</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleAnalytics" className="text-right block">Google Analytics ID</Label>
            <Input
              id="googleAnalytics"
              placeholder="G-XXXXXXXXXX"
              value={settings.google_analytics_id}
              onChange={(e) => setSettings(p => ({ ...p, google_analytics_id: e.target.value }))}
              className="text-right rounded-xl"
            />
          </div>

          {storeSlug && (
            <p className="text-xs text-muted-foreground text-right">
              المتجر: <span className="font-mono">{storeSlug}</span>
            </p>
          )}

          <Button onClick={saveSettings} disabled={loading} className="w-full rounded-xl">
            {loading ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </CardContent>
      </Card>

      <MetaDiagnosticsPanel
        pixelConfigured={Boolean(settings.meta_pixel_id.trim())}
        capiConfigured={tokenConfigured}
        marketingEnabled={settings.marketing_enabled}
      />
    </div>
  );
}
