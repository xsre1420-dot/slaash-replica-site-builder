import { useState, useEffect } from "react";
import { Globe, Check, AlertCircle, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface CustomDomainTabProps {
  storeSlug: string;
}

const CustomDomainTab = ({ storeSlug }: CustomDomainTabProps) => {
  const { user } = useAuth();
  const [domain, setDomain] = useState("");
  const [savedDomain, setSavedDomain] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      (supabase as any)
        .from('store_settings')
        .select('custom_domain, domain_verified')
        .eq('owner_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.custom_domain) {
            setDomain(data.custom_domain);
            setSavedDomain(data.custom_domain);
            setVerified(data.domain_verified ?? false);
          }
        });
    }
  }, [user?.id]);

  const cleanDomain = (input: string) => {
    return input
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '');
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const cleaned = cleanDomain(domain);
    if (!cleaned || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleaned)) {
      toast.error("يرجى إدخال نطاق صحيح (مثال: shop.example.com)");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('store_settings')
        .update({ custom_domain: cleaned, domain_verified: false })
        .eq('owner_id', user.id);

      if (error) {
        if (error.code === '23505') {
          toast.error("هذا النطاق مستخدم بالفعل من متجر آخر");
        } else {
          toast.error("فشل في حفظ النطاق");
        }
        return;
      }

      setSavedDomain(cleaned);
      setDomain(cleaned);
      setVerified(false);
      toast.success("تم حفظ النطاق. اتبع تعليمات DNS أدناه.");
    } catch {
      toast.error("حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await (supabase as any)
        .from('store_settings')
        .update({ custom_domain: null, domain_verified: false })
        .eq('owner_id', user.id);
      
      setDomain("");
      setSavedDomain(null);
      setVerified(false);
      toast.success("تم إزالة النطاق المخصص");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const defaultStoreUrl = `${window.location.origin}/store/${storeSlug}`;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 justify-end">
        <h3 className="text-lg font-bold text-foreground">النطاق المخصص</h3>
        <Globe className="w-5 h-5 text-muted-foreground" />
      </div>

      <p className="text-sm text-muted-foreground text-right">
        اربط نطاقك الخاص بمتجرك بدلاً من الرابط الافتراضي
      </p>

      {/* Current URL */}
      <div className="bg-muted/50 rounded-xl p-4 border border-border">
        <Label className="text-right block text-xs text-muted-foreground mb-2">الرابط الحالي لمتجرك</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => copyToClipboard(defaultStoreUrl, 'current')}
          >
            {copied === 'current' ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
          </Button>
          <p className="text-sm text-foreground font-mono truncate flex-1 text-left" dir="ltr">
            {defaultStoreUrl}
          </p>
        </div>
      </div>

      {/* Domain input */}
      <div className="space-y-2">
        <Label className="text-right block text-foreground font-medium">النطاق المخصص</Label>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving || !domain.trim()}
            className="shrink-0 rounded-xl"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
          </Button>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="shop.example.com"
            className="text-left rounded-xl border-border font-mono text-sm"
            dir="ltr"
          />
        </div>
      </div>

      {/* Status */}
      {savedDomain && (
        <div className={`rounded-xl p-4 border ${verified ? 'bg-primary/5 border-primary/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
          <div className="flex items-center gap-2 justify-end mb-2">
            {verified ? (
              <>
                <span className="text-sm font-medium text-primary">مُفعّل</span>
                <Check className="w-4 h-4 text-primary" />
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">في انتظار إعداد DNS</span>
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </>
            )}
          </div>

          {!verified && (
            <div className="space-y-4 mt-3">
              <p className="text-xs text-muted-foreground text-right">
                أضف سجل CNAME التالي في إعدادات DNS لنطاقك:
              </p>

              <div className="bg-background rounded-lg p-3 space-y-3 border border-border">
                <DnsRecord
                  label="النوع"
                  value="CNAME"
                  onCopy={() => copyToClipboard('CNAME', 'type')}
                  isCopied={copied === 'type'}
                />
                <DnsRecord
                  label="الاسم"
                  value={savedDomain.split('.')[0]}
                  onCopy={() => copyToClipboard(savedDomain.split('.')[0], 'name')}
                  isCopied={copied === 'name'}
                />
                <DnsRecord
                  label="القيمة"
                  value={`${storeSlug}.store.yourdomain.app`}
                  onCopy={() => copyToClipboard(`${storeSlug}.store.yourdomain.app`, 'value')}
                  isCopied={copied === 'value'}
                />
              </div>

              <p className="text-xs text-muted-foreground text-right">
                ⏱️ قد يستغرق انتشار DNS حتى 48 ساعة. سيتم التحقق تلقائياً.
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <Button
              variant="destructive"
              size="sm"
              className="rounded-lg text-xs"
              onClick={handleRemove}
              disabled={saving}
            >
              إزالة النطاق
            </Button>
            {savedDomain && (
              <a
                href={`https://${savedDomain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="rounded-lg text-xs">
                  <ExternalLink className="w-3 h-3 ml-1" />
                  فتح النطاق
                </Button>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DnsRecord = ({ label, value, onCopy, isCopied }: { label: string; value: string; onCopy: () => void; isCopied: boolean }) => (
  <div className="flex items-center justify-between gap-2">
    <button onClick={onCopy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
      {isCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
    <div className="flex items-center gap-3 flex-1 justify-end">
      <code className="text-xs font-mono text-foreground bg-muted px-2 py-1 rounded" dir="ltr">{value}</code>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  </div>
);

export default CustomDomainTab;
