import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecoveryMonitor } from '@/hooks/useRecoveryMonitor';
import {
  deactivateFailover,
  downloadLocalBackup,
  resetSupabaseClient,
} from '@/lib/disasterRecovery';

const RecoveryBanner = () => {
  const { mode, runHealthCheck } = useRecoveryMonitor();

  if (mode === 'normal') return null;

  const isFailover = mode === 'failover';

  const handleReturnPrimary = () => {
    deactivateFailover();
    resetSupabaseClient();
    window.location.reload();
  };

  return (
    <div
      className={`px-4 py-2 text-sm flex flex-wrap items-center justify-between gap-2 ${
        isFailover ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100' : 'bg-destructive/10 text-destructive'
      }`}
      dir="rtl"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          {isFailover
            ? 'تم التبديل إلى خادم احتياطي. بعض البيانات قد تكون غير محدّثة.'
            : 'تعذر الاتصال بالخادم الرئيسي. يعمل التطبيق في وضع متدهور.'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg gap-1" onClick={() => downloadLocalBackup()}>
          <Download className="w-3.5 h-3.5" />
          نسخ محلي
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg gap-1" onClick={() => runHealthCheck()}>
          <RefreshCw className="w-3.5 h-3.5" />
          فحص
        </Button>
        {isFailover && (
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" onClick={handleReturnPrimary}>
            العودة للرئيسي
          </Button>
        )}
      </div>
    </div>
  );
};

export default RecoveryBanner;
