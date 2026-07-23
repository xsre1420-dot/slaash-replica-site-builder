import { useEffect, useState } from 'react';
import { Copy, Check, ExternalLink, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import {
  buildStorePublicUrl,
  copyStorePublicUrl,
  getStoreLinkShareHint,
  resolveStorePublicUrl,
} from '@/lib/storeUrl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const StorePublicLinkBar = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const { storeName } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void resolveStorePublicUrl(user.id, {
      username: user.username,
      storeName: user.store_name || storeName,
    }).then((resolved) => {
      if (!cancelled) {
        setUrl(resolved);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username, user?.store_name, storeName]);

  const handleCopy = async () => {
    if (!user?.id) return;
    try {
      const copiedUrl = await copyStorePublicUrl(user.id, {
        username: user.username,
        storeName: user.store_name || storeName,
      });
      if (!copiedUrl) {
        toast.error('تعذّر إنشاء رابط المتجر — حاول مرة أخرى');
        return;
      }
      setUrl(copiedUrl);
      setCopied(true);
      const hint = getStoreLinkShareHint(copiedUrl);
      toast.success('تم نسخ رابط المتجر', hint ? { description: hint, duration: 5000 } : undefined);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('فشل في نسخ الرابط');
    }
  };

  const slug = url ? url.split('/store/')[1]?.split('?')[0] : null;
  const previewPath = slug ? buildStorePublicUrl(decodeURIComponent(slug)).replace(/^https?:\/\/[^/]+/, '') : null;

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 sm:px-5 sm:py-3.5',
        className
      )}
      dir="rtl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Link2 className="h-4 w-4" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">رابط متجرك العام</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            كل متجر له رابط فريد — شاركه مع عملائك لفتح صفحة المتجر مباشرة
          </p>

          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              جاري تجهيز الرابط...
            </div>
          ) : url ? (
            <p className="mt-2 truncate text-xs font-mono text-foreground/90 direction-ltr text-left" dir="ltr">
              {url}
            </p>
          ) : (
            <p className="mt-2 text-xs text-destructive">تعذّر إنشاء الرابط — أعد تحميل الصفحة</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {url && (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl"
              aria-label="فتح المتجر"
              asChild
            >
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Button
            variant={copied ? 'default' : 'outline'}
            size="icon"
            className={cn('h-10 w-10 rounded-xl', copied && 'bg-success hover:bg-success/90 border-success')}
            onClick={() => void handleCopy()}
            disabled={loading || !user?.id}
            aria-label="نسخ رابط المتجر"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {previewPath && url && (
        <p className="mt-2 pr-12 text-[11px] text-muted-foreground">
          مسار المتجر: <span className="font-mono direction-ltr">{previewPath}</span>
        </p>
      )}
    </div>
  );
};

export default StorePublicLinkBar;
