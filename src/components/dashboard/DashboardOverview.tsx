import { Link } from 'react-router-dom';
import { useState } from 'react';
import { format } from 'date-fns';
import {
  ShoppingBag,
  Clock,
  TrendingUp,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import StatCard from '@/components/ui/StatCard';
import { useOrders } from '@/hooks/useOrders';
import { useDashboardInsights } from '@/hooks/useDashboardInsights';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { formatKpiTrend } from '@/utils/dashboardInsightsUtils';
import AttentionAlertLink from '@/components/dashboard/AttentionAlertLink';
import { cn } from '@/lib/utils';

const statusConfig = {
  completed: { label: 'مكتمل', icon: CheckCircle, className: 'bg-success/10 text-success' },
  pending: { label: 'قيد الانتظار', icon: Clock, className: 'bg-warning/10 text-warning' },
  cancelled: { label: 'ملغي', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
};

const DashboardOverview = () => {
  const { orders, loading, refetch } = useOrders();
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const { actions, today, yesterday, loading: insightsLoading } =
    useDashboardInsights(statsRefreshKey);

  useRealtimeOrders(() => {
    refetch();
    setStatsRefreshKey((k) => k + 1);
  });

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const todaySalesTrend = formatKpiTrend(today.revenue, yesterday.revenue, today.orders);
  const todayVisitsTrend = formatKpiTrend(today.visits, yesterday.visits);

  const showSkeleton = loading && orders.length === 0 && insightsLoading;

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {actions.length > 0 && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="ds-section-title">يحتاج انتباهك</h3>
            <span className="text-[11px] font-medium text-destructive/80 bg-destructive/10 px-2 py-0.5 rounded-full tabular-nums">
              {actions.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {actions.map((action) => (
              <AttentionAlertLink
                key={action.id}
                id={action.id}
                title={action.title}
                description={action.description}
                href={action.href}
                icon={action.icon}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="ds-section-title mb-4 px-1">ملخص اليوم</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="مبيعات اليوم (د.ع)"
            value={today.revenue.toLocaleString()}
            icon={TrendingUp}
            trend={todaySalesTrend.trend}
            trendUp={todaySalesTrend.trendUp}
          />
          <StatCard
            label="زوار اليوم"
            value={today.visits.toLocaleString()}
            icon={Eye}
            trend={todayVisitsTrend.trend}
            trendUp={todayVisitsTrend.trendUp}
            iconClassName="bg-violet-500/10 [&_svg]:text-violet-600"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="ds-section-title">آخر الطلبات</h3>
          {orders.length > 0 && (
            <Link to="/orders" className="text-xs text-primary hover:text-primary/80 font-medium">
              عرض الكل
            </Link>
          )}
        </div>

        {recentOrders.length > 0 ? (
          <div className="ds-card divide-y divide-border/40 overflow-hidden">
            {recentOrders.map((order) => {
              const config =
                statusConfig[order.status as keyof typeof statusConfig] ?? statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-medium text-foreground truncate">{order.customerInfo.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(order.date), 'yyyy-MM-dd · hh:mm a')}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-foreground tabular-nums shrink-0">
                    {order.total.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">د.ع</span>
                  </p>
                  <Badge className={cn('border-0 shrink-0', config.className)}>
                    <StatusIcon className="w-3 h-3 ml-1" />
                    {config.label}
                  </Badge>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="ds-card p-6 text-center">
            <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد طلبات بعد — شارك رابط متجرك مع عملائك</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
