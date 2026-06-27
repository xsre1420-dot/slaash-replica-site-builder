import { Activity, Database, HardDrive, KeyRound, Radio, Server, RefreshCw, AlertTriangle } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePlatformMonitoring } from '@/hooks/usePlatformMonitoring';
import { cn } from '@/lib/utils';
import type { SubsystemStatus } from '@/services/platformMonitoringService';

const statusLabel: Record<SubsystemStatus, string> = {
  healthy: 'سليم',
  degraded: 'متدهور',
  critical: 'حرج',
  unknown: 'غير معروف',
};

const statusClass: Record<SubsystemStatus, string> = {
  healthy: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  degraded: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  critical: 'bg-red-500/10 text-red-700 border-red-500/20',
  unknown: 'bg-muted text-muted-foreground border-border',
};

const domainLabel: Record<string, string> = {
  'product.create': 'إنشاء منتج',
  'product.publish': 'نشر منتج',
  'auth.login': 'تسجيل الدخول',
  'auth.register': 'التسجيل',
  checkout: 'الدفع',
  order: 'الطلبات',
  inventory: 'المخزون',
  database: 'قاعدة البيانات',
  realtime: 'Realtime',
  api: 'API',
};

const StatusBadge = ({ status }: { status: SubsystemStatus }) => (
  <Badge variant="outline" className={cn('font-medium', statusClass[status])}>
    {statusLabel[status]}
  </Badge>
);

const Card = ({
  title,
  icon: Icon,
  status,
  children,
}: {
  title: string;
  icon: React.ElementType;
  status: SubsystemStatus;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <StatusBadge status={status} />
    </div>
    <div className="text-xs text-muted-foreground space-y-1">{children}</div>
  </div>
);

const AdminPlatformHealth = () => {
  const { snapshot, loading, error, refresh } = usePlatformMonitoring(true);

  return (
    <AdminLayout title="صحة المنصة">
      <div className="space-y-5" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              مراقبة الأخطاء، قاعدة البيانات، التخزين، المصادقة، والـ Realtime
            </p>
            {snapshot && (
              <p className="text-[11px] text-muted-foreground mt-1 font-mono" dir="ltr">
                {snapshot.timestamp}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {snapshot && <StatusBadge status={snapshot.overall} />}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              disabled={loading}
              onClick={() => void refresh(true)}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              تحديث
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {snapshot && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Card title="النظام" icon={Server} status={snapshot.system.status}>
                <p>تطبيق SPA: {snapshot.system.appHealth ? '✓ health.json' : '✗ غير متاح'}</p>
                <p>نقطة النهاية: {snapshot.system.endpointLabel}</p>
                <p>الاتصال: {snapshot.system.endpointReachable === null ? '—' : snapshot.system.endpointReachable ? 'متصل' : 'منقطع'}</p>
                <p>فشل متتالي: {snapshot.system.consecutiveFailures}</p>
                {snapshot.system.failoverActive && <p className="text-amber-600">وضع Failover نشط</p>}
              </Card>

              <Card title="قاعدة البيانات" icon={Database} status={snapshot.database.status}>
                <p>إصدار المخطط: v{snapshot.database.schemaVersion} / v{snapshot.database.requiredVersion}</p>
                <p>الحالة: {snapshot.database.message}</p>
                {snapshot.database.missing.length > 0 && (
                  <p className="text-amber-600">{snapshot.database.missing.length} عناصر ناقصة</p>
                )}
              </Card>

              <Card title="التخزين" icon={HardDrive} status={snapshot.storage.status}>
                <p>حاوية product-images: {snapshot.storage.available ? 'مهيأة' : 'غير مهيأة'}</p>
              </Card>

              <Card title="المصادقة" icon={KeyRound} status={snapshot.authentication.status}>
                <p>فشل تسجيل الدخول (15 د): {snapshot.authentication.loginFailures}</p>
                <p>فشل التسجيل (15 د): {snapshot.authentication.registerFailures}</p>
              </Card>

              <Card title="Realtime" icon={Radio} status={snapshot.realtime.status}>
                <p>قنوات منتجات: {snapshot.realtime.activeProductChannels}</p>
                <p>قنوات طلبات: {snapshot.realtime.activeOrderChannels}</p>
                <p>إعادة اتصال معلقة: {snapshot.realtime.pendingReconnects}</p>
                <p>تجاوز الحد الأقصى: {snapshot.realtime.maxAttemptsExceeded}</p>
              </Card>

              <Card title="API / الاستعلامات" icon={Activity} status={snapshot.api.status}>
                <p>فشل RPC/استعلام (15 د): {snapshot.api.recentFailures}</p>
                <p>استعلامات بطيئة (&gt;2s): {snapshot.api.slowQueries}</p>
              </Card>
            </div>

            <div className="rounded-2xl border border-border/60 overflow-hidden">
              <div className="bg-muted/40 px-4 py-3 border-b border-border/50">
                <h3 className="font-semibold text-sm">تتبع الأخطاء (آخر 15 دقيقة — هذه الجلسة)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-muted-foreground text-xs border-b border-border/40">
                      <th className="px-4 py-2 font-medium">المجال</th>
                      <th className="px-4 py-2 font-medium">المحاولات</th>
                      <th className="px-4 py-2 font-medium">فشل</th>
                      <th className="px-4 py-2 font-medium">نسبة الفشل</th>
                      <th className="px-4 py-2 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.errorDomains.map((row) => (
                      <tr key={row.domain} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-2.5">{domainLabel[row.domain] ?? row.domain}</td>
                        <td className="px-4 py-2.5 tabular-nums">{row.total}</td>
                        <td className="px-4 py-2.5 tabular-nums text-red-600">{row.failures}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {row.total > 0 ? `${Math.round(row.failureRate * 100)}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPlatformHealth;
