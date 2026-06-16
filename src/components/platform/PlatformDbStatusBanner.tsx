import { AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlatformDbHealth } from '@/hooks/usePlatformDbHealth';

const PlatformDbStatusBanner = () => {
  const { health, loading, refresh, needsAttention } = usePlatformDbHealth();

  if (!needsAttention || !health) return null;

  return (
    <div
      className="mx-4 mt-4 mb-0 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-right font-arabic"
      role="alert"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Database className="w-4 h-4" />
              مشكلة في ربط المنصة بقاعدة البيانات
            </p>
            <p className="text-sm text-foreground/90">{health.userMessage}</p>
            {health.actionHint && (
              <p className="text-xs text-muted-foreground leading-relaxed">{health.actionHint}</p>
            )}
            {health.missing.length > 0 && health.missing.length <= 6 && (
              <p className="text-[11px] text-muted-foreground font-mono dir-ltr text-left">
                {health.missing.join(' · ')}
              </p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg shrink-0"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCw className={`w-3.5 h-3.5 ml-1 ${loading ? 'animate-spin' : ''}`} />
          إعادة الفحص
        </Button>
      </div>
    </div>
  );
};

export default PlatformDbStatusBanner;
