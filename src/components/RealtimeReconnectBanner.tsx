import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import {
  forceReconnectMerchantRealtime,
  getMerchantRealtimeHubStatus,
} from '@/lib/merchantRealtimeHub';
import { useVisibilityAwareInterval } from '@/hooks/useVisibilityAwareInterval';

/** Merchant dashboard banner when Realtime channels need manual reconnect. */
export default function RealtimeReconnectBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const status = getMerchantRealtimeHubStatus();
    setVisible(status.maxAttemptsExceeded > 0 || status.pendingReconnects > 0);
  }, [user?.id]);

  useVisibilityAwareInterval(() => {
    if (!user?.id) return;
    const status = getMerchantRealtimeHubStatus();
    setVisible(status.maxAttemptsExceeded > 0 || status.pendingReconnects > 0);
  }, 15_000, !!user?.id);

  if (!visible || !user?.id) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-arabic"
      dir="rtl"
      role="status"
    >
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>انقطع اتصال التحديثات الفورية — قد لا تظهر الطلبات والمنتجات فوراً.</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-lg border-amber-600/40"
        onClick={() => {
          forceReconnectMerchantRealtime(user.id);
          setVisible(false);
        }}
      >
        <RefreshCw className="ml-2 h-4 w-4" />
        إعادة الاتصال
      </Button>
    </div>
  );
}
