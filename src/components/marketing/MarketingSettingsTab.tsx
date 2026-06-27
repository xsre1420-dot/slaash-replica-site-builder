import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  fetchMerchantMarketingSettings,
  upsertMerchantMarketingSettings,
} from "@/services/marketingService";

interface MarketingSettings {
  meta_pixel_id: string;
  facebook_access_token: string;
  google_analytics_id: string;
  marketing_enabled: boolean;
  email_marketing_enabled: boolean;
  sms_marketing_enabled: boolean;
}

export default function MarketingSettingsTab() {
  const { user } = useAuth();
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<MarketingSettings>({
    meta_pixel_id: '',
    facebook_access_token: '',
    google_analytics_id: '',
    marketing_enabled: false,
    email_marketing_enabled: false,
    sms_marketing_enabled: false
  });

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const data = await fetchMerchantMarketingSettings(user.id);
    setStoreSlug(data?.store_slug || null);
    if (data) {
      setSettings({
        meta_pixel_id: data.meta_pixel_id,
        facebook_access_token: '',
        google_analytics_id: data.google_analytics_id,
        marketing_enabled: data.marketing_enabled,
        email_marketing_enabled: data.email_marketing_enabled,
        sms_marketing_enabled: data.sms_marketing_enabled,
      });
    }
  }, [user]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async () => {
    if (!user) return;
    setLoading(true);
    const result = await upsertMerchantMarketingSettings(user.id, {
      ...settings,
    });

    if (!result.success) toast.error("فشل في حفظ الإعدادات");
    else {
      if (result.storeSlug) setStoreSlug(result.storeSlug);
      toast.success("تم حفظ إعدادات التسويق بنجاح");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/20 rounded-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-right text-base">إعدادات Meta Pixel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaPixelId" className="text-right block">Meta Pixel ID</Label>
            <Input
              id="metaPixelId"
              placeholder="أدخل Meta Pixel ID"
              value={settings.meta_pixel_id}
              onChange={(e) => setSettings(p => ({ ...p, meta_pixel_id: e.target.value }))}
              className="text-right rounded-xl"
            />
            <p className="text-xs text-muted-foreground text-right">
              يمكنك العثور على Pixel ID في إعدادات Meta Business Manager
            </p>
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

          <div className="flex items-center justify-between p-3 border border-border/20 rounded-xl">
            <Switch
              checked={settings.marketing_enabled}
              onCheckedChange={(checked) => setSettings(p => ({ ...p, marketing_enabled: checked }))}
            />
            <div className="text-right">
              <Label>تفعيل التتبع التسويقي</Label>
              <p className="text-xs text-muted-foreground">تفعيل Meta Pixel و Google Analytics</p>
            </div>
          </div>

          <Button onClick={saveSettings} disabled={loading} className="w-full rounded-xl">
            {loading ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
