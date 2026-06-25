import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setSyncing(true);
      window.setTimeout(() => setSyncing(false), 2500);
    };

    const handleOffline = () => setIsOffline(true);

    const handleSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ flushed: number; remaining: number }>).detail;
      setSyncing(false);
      if (detail.flushed > 0) {
        toast.success(`تمت مزامنة ${detail.flushed} عملية محفوظة`);
      } else if (detail.remaining > 0) {
        toast.warning(`تعذر مزامنة ${detail.remaining} عملية — حاول مجدداً`);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-flushed', handleSynced);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-flushed', handleSynced);
    };
  }, []);

  if (!isOffline && !syncing) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground py-2 px-4 text-center text-sm font-medium font-arabic animate-fade-in" dir="rtl">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>
          {syncing
            ? 'جارٍ مزامنة التغييرات المحفوظة...'
            : 'لا يوجد اتصال بالإنترنت — سيتم حفظ التغييرات عند العودة'}
        </span>
      </div>
    </div>
  );
};

export default OfflineBanner;
