import { Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlatformDbHealth } from '@/hooks/usePlatformDbHealth';
import { cn } from '@/lib/utils';

const formatMissingLabel = (item: string) => {
  if (item.startsWith('function:')) return item.slice('function:'.length);
  if (item.startsWith('table:')) return `جدول ${item.slice('table:'.length)}`;
  if (item.startsWith('column:')) return item.slice('column:'.length);
  return item;
};

const PlatformDbStatusBanner = () => {
  const { health, loading, refresh, needsAttention } = usePlatformDbHealth();

  if (!needsAttention || !health) return null;

  const missingCount = health.missing.length;
  const missingPreview = health.missing.slice(0, 4);
  const hiddenMissingCount = Math.max(0, health.missing.length - missingPreview.length);
  const mobileSummary =
    missingCount > 0
      ? `${missingCount} عناصر ناقصة — بعض الميزات متوقفة`
      : 'يجب تطبيق تحديثات قاعدة البيانات';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
      <div
        className={cn(
          'rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-2.5 sm:rounded-2xl sm:p-4',
          'sm:bg-gradient-to-bl sm:from-amber-500/[0.07] sm:via-card sm:to-card sm:shadow-sm sm:ring-1 sm:ring-amber-500/10'
        )}
        role="alert"
        dir="rtl"
      >
        <div className="flex flex-col sm:gap-1">
          <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 sm:h-9 sm:w-9 sm:rounded-xl sm:ring-1 sm:ring-inset sm:ring-amber-500/20">
            <Database className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 sm:h-4 sm:w-4" strokeWidth={2} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5 sm:gap-2">
              <div className="min-w-0 flex-1 text-right">
                <p className="text-xs font-semibold leading-tight text-foreground sm:text-sm">
                  قاعدة البيانات غير متزامنة
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:hidden">
                  {mobileSummary}
                </p>
                <p className="mt-1 hidden text-xs leading-relaxed text-muted-foreground sm:block sm:text-sm">
                  {health.userMessage}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-lg text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 sm:hidden"
                disabled={loading}
                aria-label="إعادة الفحص"
                onClick={() => void refresh()}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </Button>
            </div>

            <code className="mt-1.5 block truncate rounded-md bg-background/80 px-2 py-1 text-left font-mono text-[10px] text-foreground dir-ltr sm:hidden">
              npm run db:deploy
            </code>

            {health.actionHint && (
              <div className="mt-2 hidden rounded-xl border border-border/60 bg-background/70 p-3 sm:block">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">لتطبيق التحديثات</p>
                <code className="block rounded-lg bg-muted/60 px-2.5 py-1.5 text-left font-mono text-xs text-foreground break-all dir-ltr">
                  npm run db:deploy
                </code>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  أو انسخ migrations إلى Supabase SQL Editor بالترتيب.
                </p>
              </div>
            )}

            {missingPreview.length > 0 && (
              <div className="mt-2 hidden flex-wrap justify-end gap-1 sm:flex">
                {missingPreview.map((item) => (
                  <span
                    key={item}
                    className="inline-flex max-w-full items-center rounded-md border border-border/50 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground truncate"
                    title={item}
                  >
                    {formatMissingLabel(item)}
                  </span>
                ))}
                {hiddenMissingCount > 0 && (
                  <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    +{hiddenMissingCount}
                  </span>
                )}
              </div>
            )}
          </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden h-9 gap-1.5 rounded-xl border-amber-500/30 bg-background/80 text-xs hover:bg-amber-500/5 sm:inline-flex sm:self-end"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            إعادة الفحص
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlatformDbStatusBanner;
